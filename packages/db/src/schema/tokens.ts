import { pgTable, text, timestamp, uuid, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

export const integrationProvider = pgEnum("integration_provider", [
  "higgsfield",
  "elevenlabs",
  "anthropic",
  "openai",
  "meta",
  "tiktok",
]);

export type IntegrationProvider = (typeof integrationProvider.enumValues)[number];

export const integrationTokens = pgTable(
  "integration_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    label: text("label"),
    encryptedSecret: text("encrypted_secret").notNull(),
    metadata: text("metadata"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserProvider: uniqueIndex("integration_tokens_user_provider_idx").on(t.userId, t.provider),
  }),
);

export type IntegrationToken = typeof integrationTokens.$inferSelect;
export type NewIntegrationToken = typeof integrationTokens.$inferInsert;
