import "server-only";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  videos,
  type Video,
  type NewVideo,
  type AspectRatio,
  type VideoStatus,
} from "@crealify/db";

export type VideoInput = {
  name: string;
  templateId: string;
  characterId?: string | null;
  voiceId?: string | null;
  aspect: AspectRatio;
  bindings: Array<{ slotId: string; blockId: string; backgroundVariantId?: string }>;
};

export async function listVideos(userId: string): Promise<Video[]> {
  return db
    .select()
    .from(videos)
    .where(eq(videos.userId, userId))
    .orderBy(desc(videos.createdAt));
}

export async function getVideo(userId: string, id: string): Promise<Video | null> {
  const rows = await db
    .select()
    .from(videos)
    .where(and(eq(videos.userId, userId), eq(videos.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createVideo(userId: string, input: VideoInput): Promise<Video> {
  const values: NewVideo = {
    userId,
    name: input.name,
    templateId: input.templateId,
    characterId: input.characterId ?? null,
    voiceId: input.voiceId ?? null,
    aspect: input.aspect,
    bindings: input.bindings,
    status: "draft",
  };
  const rows = await db.insert(videos).values(values).returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create video");
  return row;
}

export async function updateVideo(
  userId: string,
  id: string,
  input: Partial<VideoInput> & { status?: VideoStatus },
): Promise<Video | null> {
  const rows = await db
    .update(videos)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
      ...(input.characterId !== undefined ? { characterId: input.characterId } : {}),
      ...(input.voiceId !== undefined ? { voiceId: input.voiceId } : {}),
      ...(input.aspect !== undefined ? { aspect: input.aspect } : {}),
      ...(input.bindings !== undefined ? { bindings: input.bindings } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(videos.userId, userId), eq(videos.id, id)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteVideo(userId: string, id: string): Promise<void> {
  await db.delete(videos).where(and(eq(videos.userId, userId), eq(videos.id, id)));
}

export async function cloneVideo(
  userId: string,
  id: string,
  patch: Partial<Pick<VideoInput, "name" | "characterId" | "voiceId" | "aspect" | "bindings">>,
): Promise<Video | null> {
  const source = await getVideo(userId, id);
  if (!source) return null;
  const cloneName = patch.name ?? `${source.name} (copy)`;
  const rows = await db
    .insert(videos)
    .values({
      userId,
      name: cloneName,
      templateId: source.templateId,
      characterId: patch.characterId !== undefined ? patch.characterId : source.characterId,
      voiceId: patch.voiceId !== undefined ? patch.voiceId : source.voiceId,
      aspect: patch.aspect ?? source.aspect,
      bindings: patch.bindings ?? source.bindings,
      status: "draft",
      parentVideoId: source.id,
    } satisfies NewVideo)
    .returning();
  return rows[0] ?? null;
}
