"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import {
  createCharacter,
  deleteCharacter,
  updateCharacter,
} from "@/lib/characters";

const optionalUrl = z
  .preprocess((v) => (v === "" || v === null ? undefined : v), z.string().url().optional())
  .nullable();

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().max(max).optional(),
  );

const characterSchema = z.object({
  name: z.string().min(1, "Name required").max(80),
  soulId: z.string().min(1, "Soul ID required").max(200),
  description: optionalText(500),
  referenceImageUrl: optionalUrl,
  defaultPreset: optionalText(80),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCharacterAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = characterSchema.safeParse({
    name: formData.get("name"),
    soulId: formData.get("soulId"),
    description: formData.get("description") || null,
    referenceImageUrl: formData.get("referenceImageUrl") || "",
    defaultPreset: formData.get("defaultPreset") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createCharacter(userId, parsed.data);
    revalidatePath("/characters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateCharacterAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = characterSchema.partial().safeParse({
    name: formData.get("name") || undefined,
    soulId: formData.get("soulId") || undefined,
    description: formData.get("description"),
    referenceImageUrl: formData.get("referenceImageUrl") ?? "",
    defaultPreset: formData.get("defaultPreset"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const updated = await updateCharacter(userId, id, parsed.data);
    if (!updated) return { ok: false, error: "Character not found" };
    revalidatePath("/characters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteCharacterAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    await deleteCharacter(userId, id);
    revalidatePath("/characters");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
