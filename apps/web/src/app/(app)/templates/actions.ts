"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import {
  createTemplate,
  deleteTemplate,
  updateTemplate,
  type SlotInput,
} from "@/lib/templates";

const slotSchema = z.object({
  id: z.string().min(1).max(60),
  slotType: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  maxDurationMs: z.coerce.number().int().positive().max(120_000).optional(),
  transitionOut: z.enum(["cut", "crossfade", "slide_left", "fade"]).optional(),
  notes: z.string().max(500).optional(),
});

const templateSchema = z.object({
  name: z.string().min(1, "Name required").max(80),
  description: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().max(500).optional(),
  ),
  slots: z.string().transform((raw, ctx) => {
    try {
      const parsed = JSON.parse(raw);
      const arr = z.array(slotSchema).min(1, "At least one slot required").max(20).parse(parsed);
      return arr as SlotInput[];
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: (err as Error).message || "Slots must be a valid array",
      });
      return z.NEVER;
    }
  }),
});

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createTemplateAction(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    slots: formData.get("slots"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const template = await createTemplate(userId, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      slots: parsed.data.slots,
    });
    revalidatePath("/templates");
    return { ok: true, id: template.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateTemplateAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    slots: formData.get("slots"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const updated = await updateTemplate(userId, id, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      slots: parsed.data.slots,
    });
    if (!updated) return { ok: false, error: "Template not found" };
    revalidatePath("/templates");
    revalidatePath(`/templates/${id}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    await deleteTemplate(userId, id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  revalidatePath("/templates");
  return { ok: true };
}
