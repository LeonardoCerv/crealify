import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  soulId: text("soul_id"),
  referenceImageUrl: text("reference_image_url"),
  defaultPreset: text("default_preset"),
  // Voice is part of a Persona — image + voice live together.
  voiceProvider: text("voice_provider").notNull().default("elevenlabs"),
  voiceExternalId: text("voice_external_id"),
  voiceSettings: jsonb("voice_settings").$type<{
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
    modelId?: string;
  }>(),
  notes: jsonb("notes").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
