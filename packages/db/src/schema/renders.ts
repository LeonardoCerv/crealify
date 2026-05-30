import { pgTable, text, timestamp, uuid, jsonb, pgEnum, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { blocks } from "./blocks";

export const renderStatus = pgEnum("render_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export type RenderStatus = (typeof renderStatus.enumValues)[number];

/**
 * Content-addressed per-block render cache.
 *
 * cacheKey = sha256(blockId + characterId + voiceId + backgroundVariantId + aspect + scriptHash + higgsfieldModelVersion)
 *
 * Any video binding that hashes to an existing row reuses its assetUrl — we never re-pay
 * Higgsfield for an identical (block × character × voice × background × aspect × script) combo.
 */
export const blockRenders = pgTable(
  "block_renders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockId: uuid("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key").notNull(),
    cacheInputs: jsonb("cache_inputs")
      .$type<{
        blockId: string;
        characterId: string | null;
        voiceId: string | null;
        backgroundVariantId: string | null;
        aspect: string;
        scriptHash: string;
        higgsfieldModelVersion: string;
      }>()
      .notNull(),
    status: renderStatus("status").notNull().default("pending"),
    assetUrl: text("asset_url"),
    durationMs: integer("duration_ms"),
    externalJobId: text("external_job_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    uniqCacheKey: uniqueIndex("block_renders_cache_key_idx").on(t.cacheKey),
  }),
);

export type BlockRender = typeof blockRenders.$inferSelect;
export type NewBlockRender = typeof blockRenders.$inferInsert;
