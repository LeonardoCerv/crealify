"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AnthropicClient, type ProposedSection } from "@crealify/anthropic";
import { ElevenLabsClient, type TranscribeSegment } from "@crealify/elevenlabs";
import {
  capturePosterFromBuffer,
  extractAudioFromUrl,
  probeRemoteUrl,
  sliceVideoUrl,
} from "@crealify/ffmpeg";
import { requireUserId } from "@/lib/session";
import { getDecryptedToken } from "@/lib/tokens";
import { publicUrl, signedPutUrl, uploadObject } from "@/lib/storage";
import { createBlock } from "@/lib/blocks";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB
const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
] as const;

const EXTENSION: Record<(typeof ALLOWED_CONTENT_TYPES)[number], string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
};

const mintSchema = z.object({
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  filename: z.string().min(1).max(200),
  byteSize: z.coerce.number().int().positive().max(MAX_VIDEO_BYTES),
});

export type MintImportUrlResult =
  | { ok: true; uploadUrl: string; publicUrl: string; key: string; expiresInSec: number }
  | { ok: false; error: string };

/**
 * Mint a presigned PUT URL for an import upload. Identical to the block-upload
 * action — separated so we can change the key prefix or size cap later.
 */
export async function mintImportUploadUrlAction(input: {
  contentType: string;
  filename: string;
  byteSize: number;
}): Promise<MintImportUrlResult> {
  const userId = await requireUserId();
  const parsed = mintSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const expiresInSec = 60 * 10;
  const ext = EXTENSION[parsed.data.contentType];
  const key = `imports/${userId}/${randomUUID()}.${ext}`;
  try {
    const uploadUrl = await signedPutUrl(key, parsed.data.contentType, expiresInSec);
    return { ok: true, uploadUrl, publicUrl: publicUrl(key), key, expiresInSec };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type AnalyzedSegment = TranscribeSegment;

export type AnalyzeResult =
  | {
      ok: true;
      sourceVideoUrl: string;
      durationSec: number;
      language: string | null;
      transcriptSegments: AnalyzedSegment[];
      sections: ProposedSection[];
    }
  | { ok: false; error: string };

const analyzeSchema = z.object({
  videoUrl: z.string().url(),
  brief: z
    .preprocess((v) => (v === "" || v === null ? undefined : v), z.string().max(500).optional()),
});

/**
 * Transcribe an uploaded video and ask Claude to propose section boundaries.
 * Synchronous because the user is waiting on it; we can move to Inngest if
 * Whisper round-trip + Claude exceeds Vercel/Next's action timeout.
 */
export async function analyzeImportedVideoAction(input: {
  videoUrl: string;
  brief?: string;
}): Promise<AnalyzeResult> {
  const userId = await requireUserId();
  const parsed = analyzeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [elevenlabs, anthropic] = await Promise.all([
    getDecryptedToken(userId, "elevenlabs"),
    getDecryptedToken(userId, "anthropic"),
  ]);
  if (!elevenlabs) return { ok: false, error: "ElevenLabs API key required — add it in Settings." };
  if (!anthropic) return { ok: false, error: "Anthropic API key required — add it in Settings." };

  try {
    // 1. Extract audio for Scribe.
    const audio = await extractAudioFromUrl(parsed.data.videoUrl);

    // 2. Transcribe with ElevenLabs Scribe.
    const eleven = new ElevenLabsClient({ apiKey: elevenlabs.secret });
    const transcript = await eleven.transcribe({
      audio: audio.buffer,
      contentType: audio.contentType,
      filename: "import.mp3",
    });
    if (transcript.segments.length === 0) {
      return { ok: false, error: "No speech detected in the audio track." };
    }

    // 3. Probe the video for an authoritative duration.
    const probed = await probeRemoteUrl(parsed.data.videoUrl);
    const totalDurationSec = probed.durationSec || transcript.durationSec || audio.durationSec;

    // 4. Ask Claude for the section breakdown.
    const client = new AnthropicClient({ apiKey: anthropic.secret });
    const segmented = await client.segmentTranscript({
      segments: transcript.segments,
      totalDurationSec,
      ...(parsed.data.brief ? { brief: parsed.data.brief } : {}),
    });

    return {
      ok: true,
      sourceVideoUrl: parsed.data.videoUrl,
      durationSec: totalDurationSec,
      language: transcript.language,
      transcriptSegments: transcript.segments,
      sections: segmented.sections,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const sectionInputSchema = z.object({
  slotType: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  startSec: z.number().min(0),
  endSec: z.number().positive(),
  text: z.string().max(4000).default(""),
});

const saveSchema = z.object({
  sourceVideoUrl: z.string().url(),
  sections: z.array(sectionInputSchema).min(1).max(10),
  hasBurnedCaptions: z.boolean().default(true),
});

export type SaveBlocksResult =
  | { ok: true; createdBlockIds: string[] }
  | { ok: false; error: string };

/**
 * For each accepted section: slice the source video at its boundaries with
 * ffmpeg, upload the cropped MP4 to storage, and create an `upload`-source
 * Block row with the script pre-filled. The user can then drop these
 * blocks into a Template like any hand-authored block.
 */
export async function saveImportedSectionsAction(input: {
  sourceVideoUrl: string;
  sections: Array<{ slotType: string; label: string; startSec: number; endSec: number; text: string }>;
  hasBurnedCaptions: boolean;
}): Promise<SaveBlocksResult> {
  const userId = await requireUserId();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const created: string[] = [];
    for (const section of parsed.data.sections) {
      const sliced = await sliceVideoUrl({
        url: parsed.data.sourceVideoUrl,
        startSec: section.startSec,
        endSec: section.endSec,
      });
      const blockKey = randomUUID();
      const videoKey = `block-imports/${userId}/${blockKey}.mp4`;
      const { url } = await uploadObject({
        key: videoKey,
        body: sliced.buffer,
        contentType: sliced.contentType,
      });

      // Poster: a single frame at the mid-point of the slice. Used as the
      // thumbnail in the block library and timeline filmstrip.
      let posterUrl: string | null = null;
      try {
        const poster = await capturePosterFromBuffer(sliced.buffer, sliced.durationSec / 2);
        const posterKey = `block-imports/${userId}/${blockKey}.jpg`;
        const posterUpload = await uploadObject({
          key: posterKey,
          body: poster.buffer,
          contentType: poster.contentType,
        });
        posterUrl = posterUpload.url;
      } catch {
        // poster extraction failures shouldn't block the import
      }

      const block = await createBlock(userId, {
        name: section.label,
        slotType: section.slotType,
        source: "upload",
        script: section.text || null,
        featuresCharacter: false,
        estimatedDurationMs: Math.round(sliced.durationSec * 1000),
        uploadedAssetUrl: url,
        posterUrl,
        hasBurnedCaptions: parsed.data.hasBurnedCaptions,
      });
      created.push(block.id);
    }

    revalidatePath("/blocks");
    revalidatePath("/videos/import");
    return { ok: true, createdBlockIds: created };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
