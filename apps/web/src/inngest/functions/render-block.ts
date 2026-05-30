import "server-only";
import { eq } from "drizzle-orm";
import { HiggsfieldClient, type LipsyncModel } from "@crealify/higgsfield";
import { ElevenLabsClient } from "@crealify/elevenlabs";
import {
  extractAudioFromUrl,
  muxAudioOverUrl,
} from "@crealify/ffmpeg";
import { db, blockRenders, blocks, characters, voices } from "@crealify/db";
import { getDecryptedToken } from "@/lib/tokens";
import { rehostUrl, uploadObject } from "@/lib/storage";
import {
  markRenderFailed,
  markRenderRunning,
  markRenderSucceeded,
} from "@/lib/renders";
import { inngest } from "../client";

/**
 * Render a single block. Picks the right Higgsfield model based on
 * block.source, fetches the right inputs (audio for lipsync, etc), stages
 * outputs in R2, persists the render row.
 */
export const renderBlockFunction = inngest.createFunction(
  {
    id: "render-block",
    retries: 2,
    concurrency: { limit: 4 },
  },
  { event: "block.render.requested" },
  async ({ event, step }) => {
    const { userId, renderId } = event.data;

    // 1. Load the render row + related block / character / voice.
    const context = await step.run("load-context", async () => {
      const renderRows = await db
        .select()
        .from(blockRenders)
        .where(eq(blockRenders.id, renderId))
        .limit(1);
      const render = renderRows[0];
      if (!render) throw new Error(`Render ${renderId} not found`);

      const blockRows = await db.select().from(blocks).where(eq(blocks.id, render.blockId)).limit(1);
      const block = blockRows[0];
      if (!block) throw new Error(`Block ${render.blockId} missing`);

      const characterId = render.cacheInputs.characterId;
      const voiceId = render.cacheInputs.voiceId;
      const [character, voice] = await Promise.all([
        characterId
          ? db
              .select()
              .from(characters)
              .where(eq(characters.id, characterId))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
        voiceId
          ? db
              .select()
              .from(voices)
              .where(eq(voices.id, voiceId))
              .limit(1)
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
      ]);

      return { render, block, character, voice };
    });

    // 2. Load BYOK tokens.
    const tokens = await step.run("load-tokens", async () => {
      const [higgsfield, elevenlabs] = await Promise.all([
        getDecryptedToken(userId, "higgsfield"),
        getDecryptedToken(userId, "elevenlabs"),
      ]);
      return { higgsfield, elevenlabs };
    });

    await step.run("mark-running", async () => {
      await markRenderRunning(renderId, null);
    });

    try {
      const cacheKey = context.render.cacheKey;
      const aspect = context.render.cacheInputs.aspect as "9:16" | "1:1" | "16:9";

      // 3a. Persona override — when a Persona (voice + optional image) is
      // attached to the video, every imported clip is regenerated:
      //   1) ElevenLabs Scribe re-transcribes the clip's audio (so we have
      //      the exact words said, even if no script was stored on the block).
      //   2) ElevenLabs TTS reads that transcript in the persona's voice.
      //   3) ffmpeg muxes the new audio over the original video frames.
      // This produces a "completely new" audio track derived from analysis
      // of the original, instead of attempting voice conversion on the
      // existing recording. Works with any ElevenLabs voice (including
      // ones that don't support s2s well) and gives a 100% clean voice.
      const persona = context.character;
      const personaVoiceId = persona?.voiceExternalId;
      const personaActive = !!(
        persona &&
        personaVoiceId &&
        context.block.uploadedAssetUrl
      );

      if (personaActive) {
        if (!tokens.elevenlabs) throw new Error("ElevenLabs token required for persona swap");

        // ⚠ Inngest serialises each step's return value to JSON, so any
        // Buffer crossing a step boundary becomes a `{type:"Buffer",data}`
        // object and breaks the next call. We pass URLs between steps and
        // re-read bytes inside each step instead.

        // 1) Extract the original audio → stage in R2.
        const sourceAudioUrl = await step.run("persona-extract-audio", async () => {
          const a = await extractAudioFromUrl(context.block.uploadedAssetUrl!);
          const up = await uploadObject({
            key: `audio-source/${cacheKey}.mp3`,
            body: a.buffer,
            contentType: a.contentType,
          });
          return up.url;
        });

        // 2) Transcribe via Scribe. Falls back to the block's stored
        //    script if Scribe finds nothing (e.g. silent clip).
        const transcribedText = await step.run(
          "persona-transcribe",
          async (): Promise<string> => {
            const res = await fetch(sourceAudioUrl);
            if (!res.ok) throw new Error(`fetch source audio: HTTP ${res.status}`);
            const sourceBuffer = Buffer.from(await res.arrayBuffer());
            const eleven = new ElevenLabsClient({ apiKey: tokens.elevenlabs!.secret });
            const result = await eleven.transcribe({
              audio: sourceBuffer,
              contentType: "audio/mpeg",
              filename: "source.mp3",
            });
            const text = result.fullText.trim();
            if (text.length > 0) return text;
            const fallback = (context.block.script ?? "").trim();
            if (fallback.length === 0) {
              throw new Error(
                "Scribe found no speech and the block has no script — nothing to TTS",
              );
            }
            return fallback;
          },
        );

        // 3) Generate new audio with the persona's voice (TTS).
        const newAudioUrl = await step.run("persona-tts", async () => {
          const eleven = new ElevenLabsClient({ apiKey: tokens.elevenlabs!.secret });
          const settings = persona.voiceSettings ?? {};
          const { modelId, ...voiceSettings } = settings;
          const out = await eleven.synthesize({
            voiceId: personaVoiceId!,
            text: transcribedText,
            modelId,
            settings: Object.keys(voiceSettings).length ? voiceSettings : undefined,
          });
          const up = await uploadObject({
            key: `audio-swapped/${cacheKey}.mp3`,
            body: Buffer.from(out.audio),
            contentType: out.contentType,
          });
          return up.url;
        });

        // 4) Mux + stage final video.
        const finalUrl = await step.run("persona-mux-stage", async () => {
          const audioRes = await fetch(newAudioUrl);
          if (!audioRes.ok) throw new Error(`fetch swapped audio: HTTP ${audioRes.status}`);
          const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
          const swapped = await muxAudioOverUrl({
            videoUrl: context.block.uploadedAssetUrl!,
            audio: audioBuffer,
            audioContentType: "audio/mpeg",
          });
          const up = await uploadObject({
            key: `renders/${cacheKey}.mp4`,
            body: swapped.buffer,
            contentType: swapped.contentType,
          });
          return { url: up.url, durationMs: Math.round(swapped.durationSec * 1000) };
        });

        await markRenderSucceeded(renderId, {
          assetUrl: finalUrl.url,
          durationMs: finalUrl.durationMs,
        });
        return { renderId };
      }

      // 3b. Per-source branch (no persona).
      switch (context.block.source) {
        case "higgsfield_lipsync": {
          if (!tokens.higgsfield) throw new Error("Higgsfield token required");
          if (!tokens.elevenlabs) throw new Error("ElevenLabs token required");
          if (!context.voice) throw new Error("Voice required for lipsync block");
          if (!context.character?.referenceImageUrl) {
            throw new Error("Character with a reference image required for lipsync");
          }
          if (!context.block.script) throw new Error("Lipsync block needs a script");

          // 3a. Synthesize voice audio via ElevenLabs.
          const audioUpload = await step.run("synthesize-audio", async () => {
            const eleven = new ElevenLabsClient({ apiKey: tokens.elevenlabs!.secret });
            const { modelId, ...voiceSettings } = context.voice!.settings ?? {};
            const tts = await eleven.synthesize({
              voiceId: context.voice!.externalId,
              text: context.block.script!,
              modelId,
              settings: Object.keys(voiceSettings).length ? voiceSettings : undefined,
            });
            const uploaded = await uploadObject({
              key: `audio/${cacheKey}.mp3`,
              body: Buffer.from(tts.audio),
              contentType: tts.contentType,
            });
            return uploaded;
          });

          // 3b. Submit lipsync job to Higgsfield + wait.
          const lipsync = await step.run("higgsfield-lipsync", async () => {
            const hf = new HiggsfieldClient({ apiToken: tokens.higgsfield!.secret });
            const modelId = (context.block.config?.higgsfield?.modelId ??
              "lipsync-2") as LipsyncModel;
            return hf.generateLipsyncVideo({
              modelId,
              portraitImageUrl: context.character!.referenceImageUrl!,
              audioUrl: audioUpload.url,
              aspect,
            });
          });

          // 3c. Stage the output MP4 in our bucket.
          const final = await step.run("stage-output", async () =>
            rehostUrl("renders", lipsync.videoUrl, cacheKey, "mp4"),
          );

          await markRenderSucceeded(renderId, {
            assetUrl: final.url,
            durationMs: lipsync.durationMs,
          });
          break;
        }

        case "higgsfield_dop": {
          if (!tokens.higgsfield) throw new Error("Higgsfield token required");
          const cfg = context.block.config?.higgsfield;
          if (!cfg?.startImageUrl) throw new Error("DoP block needs a start image URL");
          const dop = await step.run("higgsfield-dop", async () => {
            const hf = new HiggsfieldClient({ apiToken: tokens.higgsfield!.secret });
            return hf.generateDopVideo({
              variant: "dop-turbo",
              startImageUrl: cfg.startImageUrl!,
              motionId: cfg.cameraMotionId,
              prompt: context.block.script ?? undefined,
              aspect,
              seed: cfg.seed,
            });
          });
          const final = await step.run("stage-output", async () =>
            rehostUrl("renders", dop.videoUrl, cacheKey, "mp4"),
          );
          await markRenderSucceeded(renderId, {
            assetUrl: final.url,
            durationMs: dop.durationMs,
          });
          break;
        }

        case "higgsfield_motion_control": {
          if (!tokens.higgsfield) throw new Error("Higgsfield token required");
          if (!context.character?.soulId) throw new Error("Character with Soul ID required");
          if (!context.block.uploadedAssetUrl) {
            throw new Error("Motion-control block needs a reference video URL");
          }
          const mc = await step.run("higgsfield-motion-control", async () => {
            const hf = new HiggsfieldClient({ apiToken: tokens.higgsfield!.secret });
            return hf.motionControl({
              referenceVideoUrl: context.block.uploadedAssetUrl!,
              soulId: context.character!.soulId,
              aspect,
            });
          });
          const final = await step.run("stage-output", async () =>
            rehostUrl("renders", mc.videoUrl, cacheKey, "mp4"),
          );
          await markRenderSucceeded(renderId, {
            assetUrl: final.url,
            durationMs: mc.durationMs,
          });
          break;
        }

        case "screen_recording":
        case "upload":
        case "broll_stock": {
          // Upload-source blocks: just rehost the user-supplied URL.
          if (!context.block.uploadedAssetUrl) {
            throw new Error("Block has no asset URL");
          }
          const final = await step.run("stage-upload", async () =>
            rehostUrl("renders", context.block.uploadedAssetUrl!, cacheKey, "mp4"),
          );
          await markRenderSucceeded(renderId, { assetUrl: final.url });
          break;
        }

        case "ai_image_to_video":
          throw new Error("ai_image_to_video block source not yet implemented");

        default: {
          const exhaustive: never = context.block.source;
          throw new Error(`Unhandled block source ${exhaustive}`);
        }
      }
    } catch (err) {
      await markRenderFailed(renderId, (err as Error).message);
      throw err;
    }

    return { renderId };
  },
);
