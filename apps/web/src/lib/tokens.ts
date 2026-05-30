import "server-only";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, integrationTokens, type IntegrationProvider } from "@crealify/db";
import { encryptSecret, decryptSecret } from "@crealify/shared";

export const PROVIDERS = [
  "higgsfield",
  "elevenlabs",
  "anthropic",
  "openai",
  "meta",
  "tiktok",
] as const satisfies readonly IntegrationProvider[];

/** Per-provider metadata stored alongside the encrypted secret. */
const metaSchemas = {
  higgsfield: z.object({ baseUrl: z.string().url().optional() }).strict(),
  elevenlabs: z.object({ baseUrl: z.string().url().optional() }).strict(),
  anthropic: z.object({}).strict(),
  openai: z.object({}).strict(),
  meta: z
    .object({
      facebookPageId: z.string().min(1).optional(),
      instagramBusinessId: z.string().min(1).optional(),
    })
    .strict(),
  tiktok: z.object({ openId: z.string().min(1).optional() }).strict(),
} as const;

export type ProviderMetadata = {
  [K in IntegrationProvider]: z.infer<(typeof metaSchemas)[K]>;
};

export function parseMetadata<P extends IntegrationProvider>(
  provider: P,
  raw: string | null | undefined,
): ProviderMetadata[P] {
  if (!raw) return metaSchemas[provider].parse({}) as ProviderMetadata[P];
  try {
    return metaSchemas[provider].parse(JSON.parse(raw)) as ProviderMetadata[P];
  } catch {
    return metaSchemas[provider].parse({}) as ProviderMetadata[P];
  }
}

/** Stores or replaces a token + metadata for a (user, provider). */
export async function saveToken<P extends IntegrationProvider>(
  userId: string,
  provider: P,
  secret: string,
  metadata: ProviderMetadata[P],
): Promise<void> {
  const encrypted = encryptSecret(secret);
  const meta = JSON.stringify(metaSchemas[provider].parse(metadata));

  await db
    .insert(integrationTokens)
    .values({
      userId,
      provider,
      encryptedSecret: encrypted,
      metadata: meta,
      lastVerifiedAt: null,
      lastError: null,
    })
    .onConflictDoUpdate({
      target: [integrationTokens.userId, integrationTokens.provider],
      set: {
        encryptedSecret: encrypted,
        metadata: meta,
        lastVerifiedAt: null,
        lastError: null,
      },
    });
}

export async function deleteToken(
  userId: string,
  provider: IntegrationProvider,
): Promise<void> {
  await db
    .delete(integrationTokens)
    .where(
      and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, provider)),
    );
}

export type TokenStatus = {
  provider: IntegrationProvider;
  configured: boolean;
  lastVerifiedAt: Date | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
};

export async function listTokenStatuses(userId: string): Promise<TokenStatus[]> {
  const rows = await db
    .select({
      provider: integrationTokens.provider,
      lastVerifiedAt: integrationTokens.lastVerifiedAt,
      lastError: integrationTokens.lastError,
      metadata: integrationTokens.metadata,
    })
    .from(integrationTokens)
    .where(eq(integrationTokens.userId, userId));

  const byProvider = new Map(rows.map((r) => [r.provider, r] as const));

  return PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      configured: !!row,
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
      lastError: row?.lastError ?? null,
      metadata: row?.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {},
    };
  });
}

export async function getDecryptedToken(
  userId: string,
  provider: IntegrationProvider,
): Promise<{ secret: string; metadata: Record<string, unknown> } | null> {
  const row = await db
    .select({
      encryptedSecret: integrationTokens.encryptedSecret,
      metadata: integrationTokens.metadata,
    })
    .from(integrationTokens)
    .where(
      and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, provider)),
    )
    .limit(1);
  const first = row[0];
  if (!first) return null;
  return {
    secret: decryptSecret(first.encryptedSecret),
    metadata: first.metadata ? (JSON.parse(first.metadata) as Record<string, unknown>) : {},
  };
}

export async function markTokenVerified(
  userId: string,
  provider: IntegrationProvider,
  ok: boolean,
  error: string | null,
): Promise<void> {
  await db
    .update(integrationTokens)
    .set({
      lastVerifiedAt: ok ? new Date() : null,
      lastError: ok ? null : error,
    })
    .where(
      and(eq(integrationTokens.userId, userId), eq(integrationTokens.provider, provider)),
    );
}
