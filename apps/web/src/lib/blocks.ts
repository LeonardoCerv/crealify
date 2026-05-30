import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db, blocks, type Block, type NewBlock, type BlockSource } from "@crealify/db";

export type BlockInput = {
  name: string;
  slotType: string;
  source: BlockSource;
  script?: string | null;
  featuresCharacter: boolean;
  estimatedDurationMs?: number | null;
  uploadedAssetUrl?: string | null;
  posterUrl?: string | null;
  hasBurnedCaptions?: boolean;
  config?: NewBlock["config"];
};

export async function listBlocks(
  userId: string,
  filter?: { slotType?: string; source?: BlockSource },
): Promise<Block[]> {
  const conditions = [eq(blocks.userId, userId)];
  if (filter?.slotType) conditions.push(eq(blocks.slotType, filter.slotType));
  if (filter?.source) conditions.push(eq(blocks.source, filter.source));
  return db
    .select()
    .from(blocks)
    .where(and(...conditions))
    .orderBy(desc(blocks.createdAt));
}

export async function getBlock(userId: string, id: string): Promise<Block | null> {
  const rows = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.userId, userId), eq(blocks.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBlock(userId: string, input: BlockInput): Promise<Block> {
  const values: NewBlock = {
    userId,
    name: input.name,
    slotType: input.slotType,
    source: input.source,
    script: input.script ?? null,
    featuresCharacter: input.featuresCharacter ? 1 : 0,
    estimatedDurationMs: input.estimatedDurationMs ?? null,
    uploadedAssetUrl: input.uploadedAssetUrl ?? null,
    posterUrl: input.posterUrl ?? null,
    hasBurnedCaptions: input.hasBurnedCaptions ? 1 : 0,
    config: input.config ?? {},
  };
  const rows = await db.insert(blocks).values(values).returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create block");
  return row;
}

export async function updateBlock(
  userId: string,
  id: string,
  input: Partial<BlockInput>,
): Promise<Block | null> {
  const rows = await db
    .update(blocks)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slotType !== undefined ? { slotType: input.slotType } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.script !== undefined ? { script: input.script } : {}),
      ...(input.featuresCharacter !== undefined
        ? { featuresCharacter: input.featuresCharacter ? 1 : 0 }
        : {}),
      ...(input.estimatedDurationMs !== undefined
        ? { estimatedDurationMs: input.estimatedDurationMs }
        : {}),
      ...(input.uploadedAssetUrl !== undefined
        ? { uploadedAssetUrl: input.uploadedAssetUrl }
        : {}),
      ...(input.posterUrl !== undefined ? { posterUrl: input.posterUrl } : {}),
      ...(input.hasBurnedCaptions !== undefined
        ? { hasBurnedCaptions: input.hasBurnedCaptions ? 1 : 0 }
        : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(blocks.userId, userId), eq(blocks.id, id)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteBlock(userId: string, id: string): Promise<void> {
  await db.delete(blocks).where(and(eq(blocks.userId, userId), eq(blocks.id, id)));
}

export const BLOCK_SOURCES: { value: BlockSource; label: string; help: string }[] = [
  {
    value: "higgsfield_lipsync",
    label: "Higgsfield — lipsync (talking character)",
    help: "Most common. Generates a character speaking the script. Requires character + voice.",
  },
  {
    value: "higgsfield_dop",
    label: "Higgsfield — DoP (cinematic image→video)",
    help: "Generates a 5s cinematic clip. Good for openers / B-roll.",
  },
  {
    value: "higgsfield_motion_control",
    label: "Higgsfield — motion control (body swap)",
    help: "Replaces a reference video's actor with your character.",
  },
  {
    value: "screen_recording",
    label: "Screen recording (Demo)",
    help: "Uploaded screen recording of your product. Doesn't feature the character.",
  },
  {
    value: "upload",
    label: "Upload (generic)",
    help: "Any pre-made video clip you provide a URL for.",
  },
  {
    value: "broll_stock",
    label: "Stock B-roll",
    help: "Stock footage URL.",
  },
  {
    value: "ai_image_to_video",
    label: "AI image → video",
    help: "Generate a clip from a still image.",
  },
];
