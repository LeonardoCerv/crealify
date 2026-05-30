"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import {
  cloneVideo,
  createVideo,
  deleteVideo,
  updateVideo,
} from "@/lib/videos";

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().uuid().optional(),
);

const bindingSchema = z.object({
  slotId: z.string().min(1).max(60),
  blockId: z.string().uuid(),
  backgroundVariantId: z
    .preprocess((v) => (v === "" || v === null ? undefined : v), z.string().max(80).optional()),
});

const videoSchema = z.object({
  name: z.string().min(1, "Name required").max(120),
  templateId: z.string().uuid(),
  characterId: optionalUuid,
  voiceId: optionalUuid,
  aspect: z.enum(["9:16", "1:1", "16:9"]),
  bindings: z.string().transform((raw, ctx) => {
    try {
      return z.array(bindingSchema).parse(JSON.parse(raw));
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Bindings must be a valid array: ${(err as Error).message}`,
      });
      return z.NEVER;
    }
  }),
});

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createVideoAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = videoSchema.safeParse({
    name: formData.get("name"),
    templateId: formData.get("templateId"),
    characterId: formData.get("characterId"),
    voiceId: formData.get("voiceId"),
    aspect: formData.get("aspect"),
    bindings: formData.get("bindings"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const video = await createVideo(userId, {
      name: parsed.data.name,
      templateId: parsed.data.templateId,
      characterId: parsed.data.characterId ?? null,
      voiceId: parsed.data.voiceId ?? null,
      aspect: parsed.data.aspect,
      bindings: parsed.data.bindings,
    });
    revalidatePath("/videos");
    return { ok: true, id: video.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateVideoAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = videoSchema.safeParse({
    name: formData.get("name"),
    templateId: formData.get("templateId"),
    characterId: formData.get("characterId"),
    voiceId: formData.get("voiceId"),
    aspect: formData.get("aspect"),
    bindings: formData.get("bindings"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const updated = await updateVideo(userId, id, {
      name: parsed.data.name,
      templateId: parsed.data.templateId,
      characterId: parsed.data.characterId ?? null,
      voiceId: parsed.data.voiceId ?? null,
      aspect: parsed.data.aspect,
      bindings: parsed.data.bindings,
    });
    if (!updated) return { ok: false, error: "Video not found" };
    revalidatePath("/videos");
    revalidatePath(`/videos/${id}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function cloneVideoAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const cloned = await cloneVideo(userId, id, {});
  if (!cloned) return { ok: false, error: "Source video not found" };
  revalidatePath("/videos");
  return { ok: true, id: cloned.id };
}

export async function deleteVideoAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    await deleteVideo(userId, id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  revalidatePath("/videos");
  return { ok: true };
}
