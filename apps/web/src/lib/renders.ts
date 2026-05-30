import "server-only";
import { eq, and } from "drizzle-orm";
import {
  db,
  blockRenders,
  type BlockRender,
  type Block,
  type Character,
  type Voice,
  type AspectRatio,
  type RenderStatus,
} from "@crealify/db";
import { computeCacheKey, hashScript, type CacheInputs } from "@crealify/shared";

const HIGGSFIELD_MODEL_VERSION = "v1"; // bump when Higgsfield ships a model change that invalidates outputs

export type CacheKeySpec = {
  block: Pick<Block, "id" | "script">;
  characterId: string | null;
  voiceId: string | null;
  aspect: AspectRatio;
  backgroundVariantId: string | null;
};

export function buildCacheKey(spec: CacheKeySpec): { cacheKey: string; inputs: CacheInputs } {
  const inputs: CacheInputs = {
    blockId: spec.block.id,
    characterId: spec.characterId,
    voiceId: spec.voiceId,
    backgroundVariantId: spec.backgroundVariantId,
    aspect: spec.aspect,
    scriptHash: hashScript(spec.block.script),
    higgsfieldModelVersion: HIGGSFIELD_MODEL_VERSION,
  };
  return { cacheKey: computeCacheKey(inputs), inputs };
}

export type RenderInputs = {
  block: Block;
  character: Character | null;
  voice: Voice | null;
  aspect: AspectRatio;
  backgroundVariantId: string | null;
};

export async function findExistingRender(cacheKey: string): Promise<BlockRender | null> {
  const rows = await db
    .select()
    .from(blockRenders)
    .where(eq(blockRenders.cacheKey, cacheKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRender(userId: string, id: string): Promise<BlockRender | null> {
  const rows = await db
    .select()
    .from(blockRenders)
    .where(and(eq(blockRenders.userId, userId), eq(blockRenders.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Look up an existing render for the cache key, or insert a pending row that
 * a worker will pick up. Returns the row plus a `created` flag so the caller
 * knows whether it needs to enqueue a job.
 */
export async function ensureRender(
  userId: string,
  input: RenderInputs,
): Promise<{ render: BlockRender; created: boolean }> {
  const { cacheKey, inputs } = buildCacheKey({
    block: input.block,
    characterId: input.character?.id ?? null,
    voiceId: input.voice?.id ?? null,
    aspect: input.aspect,
    backgroundVariantId: input.backgroundVariantId,
  });
  const existing = await findExistingRender(cacheKey);
  if (existing) return { render: existing, created: false };

  const inserted = await db
    .insert(blockRenders)
    .values({
      userId,
      blockId: input.block.id,
      cacheKey,
      cacheInputs: inputs,
      status: "pending",
    })
    .onConflictDoNothing({ target: blockRenders.cacheKey })
    .returning();

  if (inserted[0]) return { render: inserted[0], created: true };

  // Conflict: another concurrent caller inserted first. Re-fetch.
  const row = await findExistingRender(cacheKey);
  if (!row) throw new Error("Failed to ensure render");
  return { render: row, created: false };
}

export async function markRenderRunning(
  renderId: string,
  externalJobId: string | null,
): Promise<void> {
  await db
    .update(blockRenders)
    .set({ status: "running", externalJobId, error: null })
    .where(eq(blockRenders.id, renderId));
}

export async function markRenderSucceeded(
  renderId: string,
  patch: { assetUrl: string; durationMs?: number },
): Promise<void> {
  await db
    .update(blockRenders)
    .set({
      status: "succeeded",
      assetUrl: patch.assetUrl,
      durationMs: patch.durationMs ?? null,
      error: null,
      completedAt: new Date(),
    })
    .where(eq(blockRenders.id, renderId));
}

export async function markRenderFailed(renderId: string, error: string): Promise<void> {
  await db
    .update(blockRenders)
    .set({ status: "failed", error: error.slice(0, 2000), completedAt: new Date() })
    .where(eq(blockRenders.id, renderId));
}

export async function resetRender(renderId: string): Promise<void> {
  await db
    .update(blockRenders)
    .set({ status: "pending", error: null, completedAt: null })
    .where(eq(blockRenders.id, renderId));
}

export type RenderRow = {
  id: string;
  blockId: string;
  status: RenderStatus;
  assetUrl: string | null;
  error: string | null;
  durationMs: number | null;
};
