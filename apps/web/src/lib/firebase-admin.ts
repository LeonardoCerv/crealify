import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let cached: App | null = null;

function loadCredentials() {
  const raw = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) {
    throw new Error(
      "FIREBASE_ADMIN_CREDENTIALS is not set. Paste the Firebase service-account JSON as a single-line string.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${(err as Error).message}`);
  }
}

export function getAdminApp(): App {
  if (cached) return cached;
  cached = getApps()[0] ?? initializeApp({ credential: cert(loadCredentials()) });
  return cached;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
