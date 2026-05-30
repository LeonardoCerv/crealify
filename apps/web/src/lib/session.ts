import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";
import { upsertUserFromSession } from "./users";

const SESSION_COOKIE = "crealify_session";
const SESSION_TTL_DAYS = 14;

export async function createSession(idToken: string): Promise<void> {
  const auth = getAdminAuth();
  const expiresIn = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: expiresIn / 1000,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      picture: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}

/** Server-action helper: returns the local users.id (UUID), upserting if first call. */
export async function requireUserId(): Promise<string> {
  const session = await requireUser();
  return upsertUserFromSession(session);
}
