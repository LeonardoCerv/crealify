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
  // Accept any of: raw single-line JSON, base64-encoded JSON, or JSON whose
  // internal newlines (in private_key) were pasted literally.
  const attempts = [
    raw,
    (() => { try { return Buffer.from(raw, "base64").toString("utf8"); } catch { return null; } })(),
    raw.replace(/\r?\n/g, "\\n"),
  ];
  for (const candidate of attempts) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch {}
  }
  throw new Error(
    "FIREBASE_ADMIN_CREDENTIALS could not be parsed as JSON or base64-encoded JSON.",
  );
}

export function getAdminApp(): App {
  if (cached) return cached;
  cached = getApps()[0] ?? initializeApp({ credential: cert(loadCredentials()) });
  return cached;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
