import { pgTable, text, timestamp, uuid, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";

export const platform = pgEnum("platform", ["facebook", "instagram", "tiktok"]);
export type Platform = (typeof platform.enumValues)[number];

export const publishStatus = pgEnum("publish_status", [
  "queued",
  "publishing",
  "succeeded",
  "failed",
]);

export type PublishStatus = (typeof publishStatus.enumValues)[number];

export const publishes = pgTable("publishes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoId: uuid("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  platform: platform("platform").notNull(),
  status: publishStatus("status").notNull().default("queued"),
  externalPostId: text("external_post_id"),
  externalPostUrl: text("external_post_url"),
  captionSnapshot: jsonb("caption_snapshot").$type<{ caption: string; hashtags: string[] }>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Publish = typeof publishes.$inferSelect;
export type NewPublish = typeof publishes.$inferInsert;
