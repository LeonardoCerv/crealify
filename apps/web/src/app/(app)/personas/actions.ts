"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ElevenLabsClient } from "@crealify/elevenlabs";
import { requireUserId } from "@/lib/session";
import { getDecryptedToken } from "@/lib/tokens";
import { publicUrl, signedPutUrl } from "@/lib/storage";
import {
  createPersona,
  deletePersona,
  updatePersona,
} from "@/lib/personas";

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

const personaSchema = z.object({
  name: z.string().min(1, "Name required").max(80),
  referenceImageUrl: optionalUrl,
  description: optionalText(500),
  soulId: optionalText(200),
  voiceExternalId: optionalText(200),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createPersonaAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = personaSchema.safeParse({
    name: formData.get("name"),
    referenceImageUrl: formData.get("referenceImageUrl") || "",
    description: formData.get("description") || null,
    soulId: formData.get("soulId") || null,
    voiceExternalId: formData.get("voiceExternalId") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createPersona(userId, {
      name: parsed.data.name,
      referenceImageUrl: parsed.data.referenceImageUrl ?? null,
      description: parsed.data.description ?? null,
      soulId: parsed.data.soulId ?? null,
      voiceExternalId: parsed.data.voiceExternalId ?? null,
    });
    revalidatePath("/personas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updatePersonaAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = personaSchema.partial().safeParse({
    name: formData.get("name") || undefined,
    referenceImageUrl: formData.get("referenceImageUrl") ?? "",
    description: formData.get("description"),
    soulId: formData.get("soulId"),
    voiceExternalId: formData.get("voiceExternalId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const updated = await updatePersona(userId, id, parsed.data);
    if (!updated) return { ok: false, error: "Persona not found" };
    revalidatePath("/personas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const IMAGE_EXT: Record<(typeof ALLOWED_IMAGE_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const mintImageSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  byteSize: z.coerce.number().int().positive().max(MAX_IMAGE_BYTES),
});

export type MintImageResult =
  | { ok: true; uploadUrl: string; publicUrl: string; key: string }
  | { ok: false; error: string };

export async function mintPersonaImageUploadAction(input: {
  contentType: string;
  byteSize: number;
}): Promise<MintImageResult> {
  const userId = await requireUserId();
  const parsed = mintImageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const ext = IMAGE_EXT[parsed.data.contentType];
  const key = `personas/${userId}/${randomUUID()}.${ext}`;
  try {
    const uploadUrl = await signedPutUrl(key, parsed.data.contentType, 60 * 10);
    return { ok: true, uploadUrl, publicUrl: publicUrl(key), key };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deletePersonaAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    await deletePersona(userId, id);
    revalidatePath("/personas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type VoiceOption = { voiceId: string; name: string; previewUrl?: string };
export type ListVoicesResult =
  | { ok: true; voices: VoiceOption[] }
  | { ok: false; error: string };

function isSpanish(v: {
  name: string;
  language?: string;
  labels?: Record<string, string>;
}): boolean {
  const haystacks: string[] = [];
  haystacks.push(v.name);
  if (v.language) haystacks.push(v.language);
  if (v.labels) for (const [k, val] of Object.entries(v.labels)) haystacks.push(`${k} ${val}`);
  const joined = haystacks.join(" ").toLowerCase();
  return (
    /\bspanish\b/.test(joined) ||
    /\bespa[nñ]ol\b/.test(joined) ||
    /(^|\s|-|_)es(\s|$|-|_)/.test(joined)
  );
}

/** Pulls the user's ElevenLabs voices (Spanish only) so they can pick from a dropdown. */
export async function listElevenLabsVoicesAction(): Promise<ListVoicesResult> {
  const userId = await requireUserId();
  const token = await getDecryptedToken(userId, "elevenlabs");
  if (!token) {
    return { ok: false, error: "Add your ElevenLabs API key in Settings first." };
  }
  try {
    const client = new ElevenLabsClient({ apiKey: token.secret });
    const result = await client.listVoices();
    const spanish = result.voices
      .filter((v) =>
        isSpanish({
          name: v.name,
          language: v.language,
          labels: v.labels,
        }),
      )
      .map((v) => ({
        voiceId: v.voiceId,
        name: v.name,
        previewUrl: v.previewUrl,
      }));
    return { ok: true, voices: spanish };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
