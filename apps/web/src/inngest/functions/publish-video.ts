import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { MetaClient } from "@crealify/meta";
import { TikTokClient } from "@crealify/tiktok";
import { db, publishes, videos, type Platform } from "@crealify/db";
import { getDecryptedToken } from "@/lib/tokens";
import {
  markPublishStatus,
  markVideoPublished,
  markVideoPublishing,
} from "@/lib/publish";
import { inngest } from "../client";

/**
 * Publish the rendered video to the selected platforms in parallel.
 * For each (video, platform) we expect a pre-existing publish row in
 * status `queued` — see `publishVideoAction` for why.
 */
export const publishVideoFunction = inngest.createFunction(
  {
    id: "publish-video",
    retries: 1,
  },
  { event: "video.publish.requested" },
  async ({ event, step }) => {
    const { userId, videoId, platforms } = event.data;

    const ctx = await step.run("load-video", async () => {
      const rows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      const video = rows[0];
      if (!video) throw new Error(`Video ${videoId} not found`);
      if (video.userId !== userId) throw new Error("Cross-user video access");
      if (!video.finalAssetUrl) throw new Error("Video has no final asset to publish");
      return video;
    });

    await step.run("mark-video-publishing", async () => {
      await markVideoPublishing(videoId);
    });

    // Run publishes in parallel — one Inngest step per platform.
    const results = await Promise.all(
      platforms.map((platform) =>
        step.run(`publish-${platform}`, async () => {
          const row = await latestQueuedPublish(userId, videoId, platform);
          if (!row) {
            return { platform, ok: false, error: "No queued publish row" } as const;
          }
          try {
            await markPublishStatus(row.id, { status: "publishing" });
            const caption = row.captionSnapshot?.caption ?? "";
            const hashtags = row.captionSnapshot?.hashtags ?? [];
            const fullCaption = composeCaption(caption, hashtags);

            switch (platform) {
              case "facebook": {
                const token = await getDecryptedToken(userId, "meta");
                if (!token) throw new Error("Meta token missing");
                const md = (token.metadata ?? {}) as {
                  facebookPageId?: string;
                  instagramBusinessId?: string;
                };
                if (!md.facebookPageId) throw new Error("Meta facebookPageId not set");
                const meta = new MetaClient({
                  accessToken: token.secret,
                  facebookPageId: md.facebookPageId,
                  instagramBusinessId: md.instagramBusinessId,
                });
                const result = await meta.postFacebookVideo({
                  videoUrl: ctx.finalAssetUrl!,
                  caption: fullCaption,
                });
                await markPublishStatus(row.id, {
                  status: "succeeded",
                  externalPostId: result.postId,
                  externalPostUrl: result.permalink,
                  error: null,
                  completedAt: new Date(),
                });
                return { platform, ok: true, postId: result.postId } as const;
              }
              case "instagram": {
                const token = await getDecryptedToken(userId, "meta");
                if (!token) throw new Error("Meta token missing");
                const md = (token.metadata ?? {}) as {
                  facebookPageId?: string;
                  instagramBusinessId?: string;
                };
                if (!md.instagramBusinessId) {
                  throw new Error("Meta instagramBusinessId not set");
                }
                const meta = new MetaClient({
                  accessToken: token.secret,
                  facebookPageId: md.facebookPageId,
                  instagramBusinessId: md.instagramBusinessId,
                });
                const result = await meta.postInstagramReel({
                  videoUrl: ctx.finalAssetUrl!,
                  caption: fullCaption,
                  shareToFeed: true,
                });
                await markPublishStatus(row.id, {
                  status: "succeeded",
                  externalPostId: result.mediaId,
                  externalPostUrl: result.permalink,
                  error: null,
                  completedAt: new Date(),
                });
                return { platform, ok: true, mediaId: result.mediaId } as const;
              }
              case "tiktok": {
                const token = await getDecryptedToken(userId, "tiktok");
                if (!token) throw new Error("TikTok token missing");
                const md = (token.metadata ?? {}) as { openId?: string };
                const tt = new TikTokClient({
                  accessToken: token.secret,
                  ...(md.openId ? { openId: md.openId } : {}),
                });
                const result = await tt.postVideo({
                  videoUrl: ctx.finalAssetUrl!,
                  title: truncate(fullCaption, 2200),
                  privacy: "PUBLIC_TO_EVERYONE",
                });
                await markPublishStatus(row.id, {
                  status: "succeeded",
                  externalPostId: result.publishedPostId ?? result.publishId,
                  externalPostUrl: result.shareUrl,
                  error: null,
                  completedAt: new Date(),
                });
                return { platform, ok: true, publishId: result.publishId } as const;
              }
            }
          } catch (err) {
            await markPublishStatus(row.id, {
              status: "failed",
              error: (err as Error).message.slice(0, 2000),
              completedAt: new Date(),
            });
            return { platform, ok: false, error: (err as Error).message } as const;
          }
        }),
      ),
    );

    // Final video status: published if every platform succeeded, otherwise leave
    // as ready_to_publish so the user can retry the failed platforms.
    const allOk = results.every((r) => r && r.ok);
    if (allOk) {
      await step.run("mark-published", async () => {
        await markVideoPublished(videoId);
      });
    } else {
      await step.run("revert-status", async () => {
        await db
          .update(videos)
          .set({ status: "ready_to_publish" })
          .where(eq(videos.id, videoId));
      });
    }

    return { videoId, results };
  },
);

async function latestQueuedPublish(userId: string, videoId: string, platform: Platform) {
  const rows = await db
    .select()
    .from(publishes)
    .where(
      and(
        eq(publishes.userId, userId),
        eq(publishes.videoId, videoId),
        eq(publishes.platform, platform),
        eq(publishes.status, "queued"),
      ),
    )
    .orderBy(desc(publishes.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

function composeCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
  return tags ? `${caption}\n\n${tags}` : caption;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
