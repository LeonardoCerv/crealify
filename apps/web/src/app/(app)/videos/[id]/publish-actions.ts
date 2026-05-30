"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { AnthropicClient } from "@crealify/anthropic";
import { blocks, db, type Platform } from "@crealify/db";
import { requireUserId } from "@/lib/session";
import { getVideo } from "@/lib/videos";
import { getDecryptedToken } from "@/lib/tokens";
import { createPublish, listPublishesForVideo, updateVideoCopy } from "@/lib/publish";
import { inngest } from "@/inngest/client";

export type CopyPerPlatform = {
  title?: string;
  facebook?: { caption: string; hashtags: string[] };
  instagram?: { caption: string; hashtags: string[] };
  tiktok?: { caption: string; hashtags: string[] };
};

const PLATFORMS = ["facebook", "instagram", "tiktok"] as const satisfies readonly Platform[];

export type GenerateCopyResult =
  | { ok: true; copy: CopyPerPlatform }
  | { ok: false; error: string };

const generateSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  brand: z.string().max(80).optional(),
  language: z.string().max(40).default("English"),
});

/**
 * Generate per-platform post copy using Claude. The video's bound block
 * scripts are concatenated as a summary for the prompt. Persists into
 * `videos.copy`.
 */
export async function generatePostCopyAction(
  videoId: string,
  formData: FormData,
): Promise<GenerateCopyResult> {
  const userId = await requireUserId();
  const parsed = generateSchema.safeParse({
    platform: formData.get("platform") || undefined,
    brand: formData.get("brand") || undefined,
    language: formData.get("language") || "English",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const video = await getVideo(userId, videoId);
  if (!video) return { ok: false, error: "Video not found" };
  if (video.bindings.length === 0) {
    return { ok: false, error: "Bind at least one block before generating copy" };
  }

  const token = await getDecryptedToken(userId, "anthropic");
  if (!token) return { ok: false, error: "Anthropic API key not configured" };

  const blockIds = video.bindings.map((b) => b.blockId);
  const fullBlocks = blockIds.length
    ? await db.select().from(blocks).where(inArray(blocks.id, blockIds))
    : [];

  const summary = video.bindings
    .map((b, i) => {
      const block = fullBlocks.find((x) => x.id === b.blockId);
      return `[${i + 1}] ${block?.slotType ?? ""}: ${block?.script ?? "(no script)"}`.trim();
    })
    .join("\n");

  const client = new AnthropicClient({ apiKey: token.secret });
  const platforms = parsed.data.platform ? [parsed.data.platform] : PLATFORMS;

  try {
    const next: CopyPerPlatform = { ...(video.copy ?? {}) };
    for (const platform of platforms) {
      const res = await client.generatePostCopy({
        videoSummary: summary,
        platform,
        ...(parsed.data.brand ? { brand: parsed.data.brand } : {}),
        language: parsed.data.language,
      });
      next[platform] = { caption: res.caption, hashtags: res.hashtags };
      if (!next.title && res.title) next.title = res.title;
    }
    await updateVideoCopy(userId, video.id, next);
    revalidatePath(`/videos/${video.id}`);
    return { ok: true, copy: next };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const saveCopySchema = z.object({
  title: z.string().max(200).optional(),
  facebook_caption: z.string().max(8000).optional(),
  facebook_hashtags: z.string().max(800).optional(),
  instagram_caption: z.string().max(8000).optional(),
  instagram_hashtags: z.string().max(800).optional(),
  tiktok_caption: z.string().max(2200).optional(),
  tiktok_hashtags: z.string().max(800).optional(),
});

function splitHashtags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
}

export type SaveCopyResult = { ok: true } | { ok: false; error: string };

export async function saveCopyAction(
  videoId: string,
  formData: FormData,
): Promise<SaveCopyResult> {
  const userId = await requireUserId();
  const parsed = saveCopySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const next: CopyPerPlatform = {
      title: parsed.data.title,
      facebook: parsed.data.facebook_caption
        ? {
            caption: parsed.data.facebook_caption,
            hashtags: splitHashtags(parsed.data.facebook_hashtags),
          }
        : undefined,
      instagram: parsed.data.instagram_caption
        ? {
            caption: parsed.data.instagram_caption,
            hashtags: splitHashtags(parsed.data.instagram_hashtags),
          }
        : undefined,
      tiktok: parsed.data.tiktok_caption
        ? {
            caption: parsed.data.tiktok_caption,
            hashtags: splitHashtags(parsed.data.tiktok_hashtags),
          }
        : undefined,
    };
    await updateVideoCopy(userId, videoId, next);
    revalidatePath(`/videos/${videoId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const publishSchema = z.object({
  platforms: z
    .array(z.enum(PLATFORMS))
    .min(1, "Pick at least one platform"),
});

export type PublishActionResult = { ok: true } | { ok: false; error: string };

export async function publishVideoAction(
  videoId: string,
  selected: Platform[],
): Promise<PublishActionResult> {
  const userId = await requireUserId();
  const parsed = publishSchema.safeParse({ platforms: selected });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const video = await getVideo(userId, videoId);
  if (!video) return { ok: false, error: "Video not found" };
  if (!video.finalAssetUrl) {
    return { ok: false, error: "Render the video first." };
  }
  if (video.status !== "ready_to_publish" && video.status !== "published") {
    return { ok: false, error: `Video status is "${video.status}". Render it first.` };
  }

  // Validate captions exist for each selected platform.
  for (const platform of parsed.data.platforms) {
    const block = video.copy?.[platform];
    if (!block?.caption) {
      return { ok: false, error: `Missing caption for ${platform}` };
    }
  }

  // Create per-platform publish rows up front so the UI sees them immediately.
  for (const platform of parsed.data.platforms) {
    const cap = video.copy![platform]!;
    await createPublish(userId, videoId, platform, {
      caption: cap.caption,
      hashtags: cap.hashtags,
    });
  }

  try {
    await inngest.send({
      name: "video.publish.requested",
      data: { userId, videoId, platforms: parsed.data.platforms },
    });
  } catch (err) {
    return { ok: false, error: `Inngest unavailable: ${(err as Error).message}` };
  }

  revalidatePath(`/videos/${videoId}`);
  return { ok: true };
}

export type PublishesSnapshot = {
  videoStatus: string;
  rows: Array<{
    id: string;
    platform: Platform;
    status: string;
    externalPostUrl: string | null;
    externalPostId: string | null;
    error: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};

export async function getPublishesSnapshotAction(
  videoId: string,
): Promise<PublishesSnapshot | null> {
  const userId = await requireUserId();
  const video = await getVideo(userId, videoId);
  if (!video) return null;
  const rows = await listPublishesForVideo(userId, videoId);
  return {
    videoStatus: video.status,
    rows: rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      status: r.status,
      externalPostUrl: r.externalPostUrl,
      externalPostId: r.externalPostId,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  };
}
