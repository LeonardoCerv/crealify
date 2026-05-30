import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { characters } from "./characters";

export const voices = pgTable("voices", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  provider: text("provider").notNull().default("elevenlabs"),
  externalId: text("external_id").notNull(),
  defaultCharacterId: uuid("default_character_id").references(() => characters.id, {
    onDelete: "set null",
  }),
  settings: jsonb("settings").$type<{
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
    modelId?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Voice = typeof voices.$inferSelect;
export type NewVoice = typeof voices.$inferInsert;
