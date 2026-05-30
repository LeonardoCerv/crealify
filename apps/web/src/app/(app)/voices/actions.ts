"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { createVoice, deleteVoice, updateVoice } from "@/lib/voices";

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().max(max).optional(),
  );

const voiceSchema = z.object({
  name: z.string().min(1, "Name required").max(80),
  externalId: z.string().min(1, "Voice ID required").max(200),
  provider: z.string().min(1).max(40).default("elevenlabs"),
  defaultCharacterId: z
    .preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.string().uuid().optional(),
    )
    .nullable(),
  modelId: optionalText(80),
  stability: z.coerce.number().min(0).max(1).optional(),
  similarityBoost: z.coerce.number().min(0).max(1).optional(),
  style: z.coerce.number().min(0).max(1).optional(),
  speakerBoost: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

function settingsFromInput(input: z.infer<typeof voiceSchema>) {
  const s: NonNullable<Parameters<typeof createVoice>[1]["settings"]> = {};
  if (input.modelId !== undefined) s.modelId = input.modelId;
  if (input.stability !== undefined) s.stability = input.stability;
  if (input.similarityBoost !== undefined) s.similarityBoost = input.similarityBoost;
  if (input.style !== undefined) s.style = input.style;
  if (input.speakerBoost !== undefined) s.speakerBoost = input.speakerBoost;
  return Object.keys(s).length ? s : null;
}

export async function createVoiceAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = voiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createVoice(userId, {
      name: parsed.data.name,
      externalId: parsed.data.externalId,
      provider: parsed.data.provider,
      defaultCharacterId: parsed.data.defaultCharacterId ?? null,
      settings: settingsFromInput(parsed.data),
    });
    revalidatePath("/voices");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateVoiceAction(id: string, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = voiceSchema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const settings = settingsFromInput(parsed.data as z.infer<typeof voiceSchema>);
    const updated = await updateVoice(userId, id, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.externalId !== undefined ? { externalId: parsed.data.externalId } : {}),
      ...(parsed.data.provider !== undefined ? { provider: parsed.data.provider } : {}),
      ...(parsed.data.defaultCharacterId !== undefined
        ? { defaultCharacterId: parsed.data.defaultCharacterId ?? null }
        : {}),
      ...(settings !== null ? { settings } : {}),
    });
    if (!updated) return { ok: false, error: "Voice not found" };
    revalidatePath("/voices");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteVoiceAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    await deleteVoice(userId, id);
    revalidatePath("/voices");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
