"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { IntegrationProvider } from "@crealify/db";
import { requireUserId } from "@/lib/session";
import {
  deleteToken,
  getDecryptedToken,
  markTokenVerified,
  parseMetadata,
  saveToken,
} from "@/lib/tokens";
import { runHealthCheck } from "@/lib/health-checks";

const providerEnum = z.enum([
  "higgsfield",
  "elevenlabs",
  "anthropic",
  "openai",
  "meta",
  "tiktok",
]);

const saveSchema = z.object({
  provider: providerEnum,
  secret: z.string().min(8, "Token looks too short"),
  facebookPageId: z.string().optional(),
  instagramBusinessId: z.string().optional(),
  openId: z.string().optional(),
  baseUrl: z.string().optional(),
});

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveTokenAction(formData: FormData): Promise<SaveResult> {
  const userId = await requireUserId();

  const parsed = saveSchema.safeParse({
    provider: formData.get("provider"),
    secret: formData.get("secret"),
    facebookPageId: formData.get("facebookPageId") || undefined,
    instagramBusinessId: formData.get("instagramBusinessId") || undefined,
    openId: formData.get("openId") || undefined,
    baseUrl: formData.get("baseUrl") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { provider, secret, ...rest } = parsed.data;

  const metadataRaw =
    provider === "meta"
      ? { facebookPageId: rest.facebookPageId, instagramBusinessId: rest.instagramBusinessId }
      : provider === "tiktok"
        ? { openId: rest.openId }
        : provider === "higgsfield" || provider === "elevenlabs"
          ? { baseUrl: rest.baseUrl }
          : {};

  try {
    const metadata = parseMetadata(provider, JSON.stringify(metadataRaw));
    await saveToken(userId, provider, secret, metadata);
    const health = await runHealthCheck(provider, secret);
    await markTokenVerified(userId, provider, health.ok, health.ok ? null : health.error);
    revalidatePath("/settings");
    return health.ok ? { ok: true } : { ok: false, error: health.error };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function verifyTokenAction(provider: IntegrationProvider): Promise<SaveResult> {
  const userId = await requireUserId();
  const token = await getDecryptedToken(userId, provider);
  if (!token) return { ok: false, error: "No token stored for this provider." };
  const health = await runHealthCheck(provider, token.secret);
  await markTokenVerified(userId, provider, health.ok, health.ok ? null : health.error);
  revalidatePath("/settings");
  return health.ok ? { ok: true } : { ok: false, error: health.error };
}

export async function deleteTokenAction(provider: IntegrationProvider): Promise<SaveResult> {
  const userId = await requireUserId();
  await deleteToken(userId, provider);
  revalidatePath("/settings");
  return { ok: true };
}
