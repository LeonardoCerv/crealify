import { pgTable, text, timestamp, uuid, jsonb, integer, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const blockSource = pgEnum("block_source", [
  "higgsfield_lipsync",
  "higgsfield_dop",
  "higgsfield_motion_control",
  "screen_recording",
  "upload",
  "broll_stock",
  "ai_image_to_video",
]);

export type BlockSource = (typeof blockSource.enumValues)[number];

export const blocks = pgTable("blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slotType: text("slot_type").notNull(),
  source: blockSource("source").notNull(),
  script: text("script"),
  featuresCharacter: integer("features_character").notNull().default(1),
  estimatedDurationMs: integer("estimated_duration_ms"),
  uploadedAssetUrl: text("uploaded_asset_url"),
  posterUrl: text("poster_url"),
  hasBurnedCaptions: integer("has_burned_captions").notNull().default(0),
  config: jsonb("config")
    .$type<{
      higgsfield?: {
        modelId?: string;
        cameraMotionId?: string;
        preset?: string;
        seed?: number;
        startImageUrl?: string;
      };
      backgroundVariants?: Array<{
        id: string;
        label: string;
        prompt?: string;
        imageUrl?: string;
        higgsfieldModelId?: string;
      }>;
      audio?: { backgroundMusicUrl?: string; gainDb?: number };
    }>()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Block = typeof blocks.$inferSelect;
export type NewBlock = typeof blocks.$inferInsert;
