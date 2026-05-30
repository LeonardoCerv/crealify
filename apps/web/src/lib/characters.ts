import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { db, characters, type Character, type NewCharacter } from "@crealify/db";

export type CharacterInput = {
  name: string;
  description?: string | null;
  soulId: string;
  referenceImageUrl?: string | null;
  defaultPreset?: string | null;
};

export async function listCharacters(userId: string): Promise<Character[]> {
  return db
    .select()
    .from(characters)
    .where(eq(characters.userId, userId))
    .orderBy(desc(characters.createdAt));
}

export async function getCharacter(userId: string, id: string): Promise<Character | null> {
  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCharacter(userId: string, input: CharacterInput): Promise<Character> {
  const values: NewCharacter = {
    userId,
    name: input.name,
    description: input.description ?? null,
    soulId: input.soulId,
    referenceImageUrl: input.referenceImageUrl ?? null,
    defaultPreset: input.defaultPreset ?? null,
  };
  const rows = await db.insert(characters).values(values).returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create character");
  return row;
}

export async function updateCharacter(
  userId: string,
  id: string,
  input: Partial<CharacterInput>,
): Promise<Character | null> {
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
      updatedAt: new Date(),
    })
    .where(and(eq(characters.userId, userId), eq(characters.id, id)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteCharacter(userId: string, id: string): Promise<void> {
  await db
    .delete(characters)
    .where(and(eq(characters.userId, userId), eq(characters.id, id)));
}
