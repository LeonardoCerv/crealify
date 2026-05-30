import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  slots: jsonb("slots")
    .$type<
      Array<{
        id: string;
        slotType: string;
        label: string;
        maxDurationMs?: number;
        transitionOut?: "cut" | "crossfade" | "slide_left" | "fade";
        notes?: string;
      }>
    >()
    .notNull()
    .default([]),
  globalOverlays: jsonb("global_overlays")
    .$type<{
      captions?: { enabled: boolean; style?: string };
      watermark?: { enabled: boolean; assetUrl?: string };
      music?: { enabled: boolean; assetUrl?: string; gainDb?: number };
    }>()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export const DEFAULT_SLOTS: Template["slots"] = [
  { id: "opener", slotType: "opener", label: "Opener (Hook)", maxDurationMs: 4000, transitionOut: "cut" },
  { id: "problem", slotType: "problem", label: "Problem", maxDurationMs: 6000, transitionOut: "cut" },
  { id: "solution", slotType: "solution", label: "Solution", maxDurationMs: 12000, transitionOut: "crossfade" },
  { id: "demo", slotType: "demo", label: "Demo / Proof", maxDurationMs: 10000, transitionOut: "cut" },
  { id: "cta", slotType: "cta", label: "CTA", maxDurationMs: 5000 },
];
