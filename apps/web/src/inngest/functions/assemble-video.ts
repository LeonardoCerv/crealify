import "server-only";
import { eq, inArray } from "drizzle-orm";
import { concatCaptionedRemoteUrls, type Clip } from "@crealify/ffmpeg";
import { characters, db, blockRenders, blocks, templates, videos } from "@crealify/db";
import { buildCacheKey } from "@/lib/renders";
import { uploadObject } from "@/lib/storage";
import { inngest } from "../client";

/**
 * Assemble the final video by concatenating per-slot rendered MP4s in
 * template-slot order, with each block's script burned in as a bottom-third
 * caption. Transitions / B-roll overlays / word-level caption timing are
 * v1.1 enhancements (likely via Remotion).
 */
export const assembleVideoFunction = inngest.createFunction(
  {
    id: "assemble-video",
    retries: 1,
  },
  { event: "video.assemble.requested" },
  async ({ event, step }) => {
    const { userId, videoId } = event.data;

    const ctx = await step.run("load", async () => {
      const videoRows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      const video = videoRows[0];
      if (!video) throw new Error(`Video ${videoId} not found`);
      if (video.userId !== userId) throw new Error("Cross-user video access");

      const tplRows = await db
        .select()
        .from(templates)
        .where(eq(templates.id, video.templateId))
        .limit(1);
      const template = tplRows[0];
      if (!template) throw new Error(`Template ${video.templateId} missing`);

      const blockIds = video.bindings.map((b) => b.blockId);
      const blockRows = blockIds.length
        ? await db.select().from(blocks).where(inArray(blocks.id, blockIds))
        : [];

      const character = video.characterId
        ? await db
            .select()
            .from(characters)
            .where(eq(characters.id, video.characterId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : null;

      return { video, template, blockRows, character };
    });

    // Persona applies to every script-bearing block — must mirror render-video.
    const personaActive = !!ctx.character?.voiceExternalId;

    // Walk bindings in the order the user authored them on the timeline.
    // Template slot ordering is ignored — the freeform composer uses
    // bindings as the source of truth.
    const orderedClips = await step.run("collect-renders", async () => {
      const captionsEnabled = ctx.template.globalOverlays?.captions?.enabled !== false;
      const clips: Clip[] = [];

      for (const binding of ctx.video.bindings) {
        const block = ctx.blockRows.find((b) => b.id === binding.blockId);
        if (!block)
          throw new Error(`Block ${binding.blockId} missing for slot ${binding.slotId}`);

        const includeCharacter = personaActive || block.featuresCharacter === 1;
        const { cacheKey } = buildCacheKey({
          block,
          characterId: includeCharacter ? ctx.video.characterId : null,
          voiceId: includeCharacter ? ctx.video.voiceId : null,
          aspect: ctx.video.aspect,
          backgroundVariantId: binding.backgroundVariantId ?? null,
        });

        const renderRow = await db
          .select()
          .from(blockRenders)
          .where(eq(blockRenders.cacheKey, cacheKey))
          .limit(1);
        const render = renderRow[0];
        if (!render || render.status !== "succeeded" || !render.assetUrl) {
          throw new Error(`Render for slot ${slotId} not ready`);
        }
        const clip: Clip = { url: render.assetUrl };
        // Skip our caption burn-in for blocks that already carry burned-in
        // captions in the source footage — avoids stacking captions on top
        // of captions.
        const alreadyHasCaptions = block.hasBurnedCaptions === 1;
        if (captionsEnabled && block.script && !alreadyHasCaptions) {
          clip.caption = block.script;
        }
        clips.push(clip);
      }

      return clips;
    });

    if (orderedClips.length === 0) {
      throw new Error("No bindings to assemble");
    }

    // Concat into the final MP4 (with burned-in captions where present) and upload.
    const finalAsset = await step.run("ffmpeg-concat", async () => {
      const result = await concatCaptionedRemoteUrls({
        clips: orderedClips,
        aspect: ctx.video.aspect,
      });
      const key = `videos/${ctx.video.id}.mp4`;
      const uploaded = await uploadObject({
        key,
        body: result.buffer,
        contentType: "video/mp4",
      });
      return { url: uploaded.url, durationSec: result.durationSec };
    });

    await step.run("persist", async () => {
      await db
        .update(videos)
        .set({
          status: "ready_to_publish",
          finalAssetUrl: finalAsset.url,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, ctx.video.id));
    });

    return { videoId: ctx.video.id, finalAssetUrl: finalAsset.url };
  },
);
