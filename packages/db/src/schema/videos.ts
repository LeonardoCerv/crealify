import { pgTable, text, timestamp, uuid, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { templates } from "./templates";
import { characters } from "./characters";
import { voices } from "./voices";

export const videoStatus = pgEnum("video_status", [
  "draft",
  "rendering",
  "ready_to_publish",
  "publishing",
  "published",
  "failed",
]);

export type VideoStatus = (typeof videoStatus.enumValues)[number];

export const aspectRatio = pgEnum("aspect_ratio", ["9:16", "1:1", "16:9"]);
export type AspectRatio = (typeof aspectRatio.enumValues)[number];

export const videos = pgTable("videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => templates.id, { onDelete: "restrict" }),
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "set null" }),
  voiceId: uuid("voice_id").references(() => voices.id, { onDelete: "set null" }),
  aspect: aspectRatio("aspect").notNull().default("9:16"),
  status: videoStatus("status").notNull().default("draft"),
  bindings: jsonb("bindings")
    .$type<
      Array<{
        slotId: string;
        blockId: string;
        backgroundVariantId?: string;
      }>
    >()
    .notNull()
    .default([]),
  finalAssetUrl: text("final_asset_url"),
  copy: jsonb("copy")
    .$type<{
      title?: string;
      facebook?: { caption: string; hashtags: string[] };
      instagram?: { caption: string; hashtags: string[] };
      tiktok?: { caption: string; hashtags: string[] };
    }>()
    .default({}),
  error: text("error"),
  parentVideoId: uuid("parent_video_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
