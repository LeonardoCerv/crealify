"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { characters, db, blockRenders, blocks, videos } from "@crealify/db";
import { requireUserId } from "@/lib/session";
import { buildCacheKey, resetRender } from "@/lib/renders";
import { inngest } from "@/inngest/client";
import { getVideo } from "@/lib/videos";

export type RenderActionResult = { ok: true } | { ok: false; error: string };

export async function startVideoRenderAction(videoId: string): Promise<RenderActionResult> {
  const userId = await requireUserId();
  const video = await getVideo(userId, videoId);
  if (!video) return { ok: false, error: "Video not found" };
  if (video.bindings.length === 0) {
    return { ok: false, error: "Bind at least one block before rendering." };
  }
  try {
    await inngest.send({
      name: "video.render.requested",
      data: { userId, videoId },
    });
  } catch (err) {
    return { ok: false, error: `Inngest unavailable: ${(err as Error).message}` };
  }
  revalidatePath(`/videos/${videoId}`);
  return { ok: true };
}

export async function retryBlockRenderAction(
  videoId: string,
  blockId: string,
): Promise<RenderActionResult> {
  const userId = await requireUserId();
  const video = await getVideo(userId, videoId);
  if (!video) return { ok: false, error: "Video not found" };

  const blockRow = await db.select().from(blocks).where(eq(blocks.id, blockId)).limit(1);
  const block = blockRow[0];
  if (!block) return { ok: false, error: "Block missing" };

  const binding = video.bindings.find((b) => b.blockId === blockId);
  if (!binding) return { ok: false, error: "Block not bound to this video" };

  const character = video.characterId
    ? await db
        .select()
        .from(characters)
        .where(eq(characters.id, video.characterId))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;
  const personaActive = !!character?.voiceExternalId;
  const includeCharacter = personaActive || block.featuresCharacter === 1;

  const { cacheKey } = buildCacheKey({
    block,
    characterId: includeCharacter ? video.characterId : null,
    voiceId: includeCharacter ? video.voiceId : null,
    aspect: video.aspect,
    backgroundVariantId: binding.backgroundVariantId ?? null,
  });

  const existing = await db
    .select()
    .from(blockRenders)
    .where(eq(blockRenders.cacheKey, cacheKey))
    .limit(1);
  const render = existing[0];
  if (!render) return { ok: false, error: "Render not found — start a full render first" };

  await resetRender(render.id);
  await inngest.send({
    name: "block.render.requested",
    data: { userId, renderId: render.id },
  });
  revalidatePath(`/videos/${videoId}`);
  return { ok: true };
}

export type RenderStatusSnapshot = {
  videoStatus: string;
  finalAssetUrl: string | null;
  /** True when the final assembly exists but some block render is no longer current. */
  staleFinalAsset: boolean;
  slots: Array<{
    slotId: string;
    blockId: string;
    blockName: string;
    renderId: string | null;
    status: "missing" | "pending" | "running" | "succeeded" | "failed";
    assetUrl: string | null;
    error: string | null;
  }>;
};

export async function getRenderStatusAction(videoId: string): Promise<RenderStatusSnapshot | null> {
  const userId = await requireUserId();
  const video = await getVideo(userId, videoId);
  if (!video) return null;

  const blockIds = video.bindings.map((b) => b.blockId);
  const blockRows = blockIds.length
    ? await db.select().from(blocks).where(inArray(blocks.id, blockIds))
    : [];

  // Persona applies to every script-bearing block. Must mirror render-video.
  const character = video.characterId
    ? await db
        .select()
        .from(characters)
        .where(eq(characters.id, video.characterId))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;
  const personaActive = !!character?.voiceExternalId;

  const slots: RenderStatusSnapshot["slots"] = [];
  for (const binding of video.bindings) {
    const block = blockRows.find((b) => b.id === binding.blockId);
    if (!block) continue;
    const includeCharacter = personaActive || block.featuresCharacter === 1;
    const { cacheKey } = buildCacheKey({
      block,
      characterId: includeCharacter ? video.characterId : null,
      voiceId: includeCharacter ? video.voiceId : null,
      aspect: video.aspect,
      backgroundVariantId: binding.backgroundVariantId ?? null,
    });
    const existing = await db
      .select()
      .from(blockRenders)
      .where(eq(blockRenders.cacheKey, cacheKey))
      .limit(1);
    const render = existing[0];
    slots.push({
      slotId: binding.slotId,
      blockId: block.id,
      blockName: block.name,
      renderId: render?.id ?? null,
      status: render ? render.status : "missing",
      assetUrl: render?.assetUrl ?? null,
      error: render?.error ?? null,
    });
  }

  const staleFinalAsset =
    !!video.finalAssetUrl && slots.some((s) => s.status !== "succeeded");

  return {
    videoStatus: video.status,
    finalAssetUrl: video.finalAssetUrl,
    staleFinalAsset,
    slots,
  };
}
