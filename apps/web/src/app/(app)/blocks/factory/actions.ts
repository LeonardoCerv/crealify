"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AnthropicClient, type HookVariant } from "@crealify/anthropic";
import type { BlockSource } from "@crealify/db";
import { requireUserId } from "@/lib/session";
import { getDecryptedToken } from "@/lib/tokens";
import { createBlock } from "@/lib/blocks";

const generateSchema = z.object({
  slotType: z.string().min(1).max(40),
  brief: z.string().min(20, "Give a slightly richer brief — at least 20 chars").max(4000),
  count: z.coerce.number().int().min(1).max(10).default(5),
  language: z.string().min(2).max(40).default("English"),
  styleNotes: z
    .preprocess((v) => (v === "" || v === null ? undefined : v), z.string().max(500).optional()),
});

const acceptSchema = z.object({
  slotType: z.string().min(1).max(40),
  source: z.enum([
    "higgsfield_lipsync",
    "higgsfield_dop",
    "higgsfield_motion_control",
    "screen_recording",
    "upload",
    "broll_stock",
    "ai_image_to_video",
  ] as const satisfies readonly BlockSource[]),
  featuresCharacter: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .default(true),
  variants: z.array(z.object({ name: z.string().min(1), script: z.string().min(1) })).min(1),
});

export type GenerateResult =
  | { ok: true; variants: HookVariant[] }
  | { ok: false; error: string };

export async function generateHookVariantsAction(formData: FormData): Promise<GenerateResult> {
  const userId = await requireUserId();
  const parsed = generateSchema.safeParse({
    slotType: formData.get("slotType"),
    brief: formData.get("brief"),
    count: formData.get("count"),
    language: formData.get("language") || "English",
    styleNotes: formData.get("styleNotes"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const token = await getDecryptedToken(userId, "anthropic");
  if (!token) {
    return {
      ok: false,
      error: "Anthropic API key not configured. Add it in Settings.",
    };
  }

  try {
    const client = new AnthropicClient({ apiKey: token.secret });
    const result = await client.generateHooks({
      slotType: parsed.data.slotType,
      brief: parsed.data.brief,
      count: parsed.data.count,
      language: parsed.data.language,
      styleNotes: parsed.data.styleNotes,
    });
    return { ok: true, variants: result.variants };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type AcceptResult = { ok: true; created: number } | { ok: false; error: string };

export async function acceptVariantsAction(input: {
  slotType: string;
  source: BlockSource;
  featuresCharacter: boolean;
  variants: { name: string; script: string }[];
}): Promise<AcceptResult> {
  const userId = await requireUserId();
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    let created = 0;
    for (const v of parsed.data.variants) {
      await createBlock(userId, {
        name: v.name,
        slotType: parsed.data.slotType,
        source: parsed.data.source,
        script: v.script,
        featuresCharacter: parsed.data.featuresCharacter,
      });
      created++;
    }
    revalidatePath("/blocks");
    return { ok: true, created };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
