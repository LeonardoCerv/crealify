import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { characters, db, type Character, type NewCharacter } from "@crealify/db";

/**
 * Persona = image (referenceImageUrl, optional Higgsfield soulId) + voice
 * (ElevenLabs voice id). We reuse the underlying `characters` table — the
 * persona is just a richer view of it.
 */
export type Persona = Character;

export type PersonaInput = {
  name: string;
  description?: string | null;
  referenceImageUrl?: string | null;
  soulId?: string | null;
  voiceProvider?: string;
  voiceExternalId?: string | null;
  voiceSettings?: Character["voiceSettings"];
  defaultPreset?: string | null;
};

export async function listPersonas(userId: string): Promise<Persona[]> {
  return db
    .select()
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(desc(characters.createdAt));
}

export async function getPersona(userId: string, id: string): Promise<Persona | null> {
  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPersona(userId: string, input: PersonaInput): Promise<Persona> {
  const values: NewCharacter = {
    userId,
    name: input.name,
    description: input.description ?? null,
    soulId: input.soulId ?? null,
    referenceImageUrl: input.referenceImageUrl ?? null,
    defaultPreset: input.defaultPreset ?? null,
    voiceProvider: input.voiceProvider ?? "elevenlabs",
    voiceExternalId: input.voiceExternalId ?? null,
    voiceSettings: input.voiceSettings ?? null,
  };
  const rows = await db.insert(characters).values(values).returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create persona");
  return row;
}

export async function updatePersona(
  userId: string,
  id: string,
  input: Partial<PersonaInput>,
): Promise<Persona | null> {
  const rows = await db
    .update(characters)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.soulId !== undefined ? { soulId: input.soulId } : {}),
      ...(input.referenceImageUrl !== undefined
        ? { referenceImageUrl: input.referenceImageUrl }
        : {}),
      ...(input.defaultPreset !== undefined ? { defaultPreset: input.defaultPreset } : {}),
      ...(input.voiceProvider !== undefined ? { voiceProvider: input.voiceProvider } : {}),
      ...(input.voiceExternalId !== undefined
        ? { voiceExternalId: input.voiceExternalId }
        : {}),
      ...(input.voiceSettings !== undefined ? { voiceSettings: input.voiceSettings } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(characters.userId, userId), eq(characters.id, id)))
    .returning();
  return rows[0] ?? null;
}

export async function deletePersona(userId: string, id: string): Promise<void> {
  await db
    .delete(characters)
    .where(and(eq(characters.userId, userId), eq(characters.id, id)));
}
