import "server-only";
import { db, users } from "@crealify/db";
import { eq, sql } from "drizzle-orm";
import type { SessionUser } from "./session";

/** Upserts the local users row for a Firebase-authenticated session and returns its UUID. */
export async function upsertUserFromSession(session: SessionUser): Promise<string> {
  const inserted = await db
    .insert(users)
    .values({
      firebaseUid: session.uid,
      email: session.email ?? `${session.uid}@unknown`,
      displayName: session.name,
      photoUrl: session.picture,
    })
    .onConflictDoUpdate({
      target: users.firebaseUid,
      set: {
        email: sql`excluded.email`,
        displayName: sql`excluded.display_name`,
        photoUrl: sql`excluded.photo_url`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: users.id });

  const row = inserted[0];
  if (!row) throw new Error("Failed to upsert user");
  return row.id;
}

/** Resolves the local user UUID for a Firebase uid, without upserting. */
export async function getUserId(firebaseUid: string): Promise<string | null> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  return row[0]?.id ?? null;
}
