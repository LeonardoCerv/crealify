"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { BlockSource } from "@crealify/db";
import { requireUserId } from "@/lib/session";
import { createBlock, deleteBlock, updateBlock } from "@/lib/blocks";

const sources = [
  "higgsfield_lipsync",
  "higgsfield_dop",
  "higgsfield_motion_control",
  "screen_recording",
  "upload",
  "broll_stock",
  "ai_image_to_video",
] as const satisfies readonly BlockSource[];

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().max(max).optional(),
  );

const optionalUrl = z
  .preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().url().optional(),
  )
  .nullable();

const blockSchema = z.object({
  name: z.string().min(1, "Name required").max(120),
  slotType: z.string().min(1, "Slot type required").max(40),
  source: z.enum(sources),
  script: optionalText(2000),
  featuresCharacter: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .default(false),
  hasBurnedCaptions: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .default(false),
  estimatedDurationMs: z.coerce.number().int().positive().max(120_000).optional(),
  uploadedAssetUrl: optionalUrl,
});

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createBlockAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const block = await createBlock(userId, {
      name: parsed.data.name,
      slotType: parsed.data.slotType,
      source: parsed.data.source,
      script: parsed.data.script ?? null,
      featuresCharacter: parsed.data.featuresCharacter,
      hasBurnedCaptions: parsed.data.hasBurnedCaptions,
      estimatedDurationMs: parsed.data.estimatedDurationMs ?? null,
      uploadedAssetUrl: parsed.data.uploadedAssetUrl ?? null,
    });
    revalidatePath("/blocks");
    return { ok: true, id: block.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateBlockAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const updated = await updateBlock(userId, id, {
      name: parsed.data.name,
      slotType: parsed.data.slotType,
      source: parsed.data.source,
      script: parsed.data.script ?? null,
      featuresCharacter: parsed.data.featuresCharacter,
      hasBurnedCaptions: parsed.data.hasBurnedCaptions,
      estimatedDurationMs: parsed.data.estimatedDurationMs ?? null,
      uploadedAssetUrl: parsed.data.uploadedAssetUrl ?? null,
    });
    if (!updated) return { ok: false, error: "Block not found" };
    revalidatePath("/blocks");
    revalidatePath(`/blocks/${id}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    await deleteBlock(userId, id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  revalidatePath("/blocks");
  return { ok: true };
}
