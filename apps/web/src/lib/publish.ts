import "server-only";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  publishes,
  videos,
  type Publish,
  type Platform,
  type PublishStatus,
  type Video,
} from "@crealify/db";

export type PublishRow = Publish;

export async function listPublishesForVideo(
  userId: string,
  videoId: string,
): Promise<PublishRow[]> {
  return db
    .select()
    .from(publishes)
    .where(and(eq(publishes.userId, userId), eq(publishes.videoId, videoId)))
    .orderBy(desc(publishes.createdAt));
}

export async function createPublish(
  userId: string,
  videoId: string,
  platform: Platform,
  captionSnapshot: { caption: string; hashtags: string[] },
): Promise<PublishRow> {
  const rows = await db
    .insert(publishes)
    .values({
      userId,
      videoId,
      platform,
      status: "queued",
      captionSnapshot,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create publish");
  return row;
}

export async function markPublishStatus(
  id: string,
  patch: Partial<{
    status: PublishStatus;
    externalPostId: string | null;
    externalPostUrl: string | null;
    error: string | null;
    completedAt: Date | null;
  }>,
): Promise<void> {
  await db.update(publishes).set(patch).where(eq(publishes.id, id));
}

export async function updateVideoCopy(
  userId: string,
  id: string,
  patch: Partial<NonNullable<Video["copy"]>>,
): Promise<void> {
  const rows = await db
    .select({ copy: videos.copy })
    .from(videos)
    .where(and(eq(videos.userId, userId), eq(videos.id, id)))
    .limit(1);
  const current = rows[0]?.copy ?? {};
  await db
    .update(videos)
    .set({ copy: { ...current, ...patch }, updatedAt: new Date() })
    .where(and(eq(videos.userId, userId), eq(videos.id, id)));
}

export async function markVideoPublishing(id: string): Promise<void> {
  await db.update(videos).set({ status: "publishing" }).where(eq(videos.id, id));
}

export async function markVideoPublished(id: string): Promise<void> {
  await db.update(videos).set({ status: "published" }).where(eq(videos.id, id));
}
