import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db, voices, type Voice, type NewVoice } from "@crealify/db";

export type VoiceInput = {
  name: string;
  externalId: string;
  provider?: string;
  defaultCharacterId?: string | null;
  settings?: NewVoice["settings"];
};

export async function listVoices(userId: string): Promise<Voice[]> {
  return db
    .select()
    .from(voices)
    .where(eq(voices.userId, userId))
    .orderBy(desc(voices.createdAt));
}

export async function getVoice(userId: string, id: string): Promise<Voice | null> {
  const rows = await db
    .select()
    .from(voices)
    .where(and(eq(voices.userId, userId), eq(voices.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createVoice(userId: string, input: VoiceInput): Promise<Voice> {
  const rows = await db
    .insert(voices)
    .values({
      userId,
      name: input.name,
      provider: input.provider ?? "elevenlabs",
      externalId: input.externalId,
      defaultCharacterId: input.defaultCharacterId ?? null,
      settings: input.settings ?? null,
    } satisfies NewVoice)
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create voice");
  return row;
}

export async function updateVoice(
  userId: string,
  id: string,
  input: Partial<VoiceInput>,
): Promise<Voice | null> {
  const rows = await db
    .update(voices)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.defaultCharacterId !== undefined
        ? { defaultCharacterId: input.defaultCharacterId }
        : {}),
      ...(input.settings !== undefined ? { settings: input.settings } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(voices.userId, userId), eq(voices.id, id)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteVoice(userId: string, id: string): Promise<void> {
  await db.delete(voices).where(and(eq(voices.userId, userId), eq(voices.id, id)));
}
