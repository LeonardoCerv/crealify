import "server-only";
import type { IntegrationProvider } from "@crealify/db";

export type HealthResult = { ok: true } | { ok: false; error: string };

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function pingElevenLabs(apiKey: string): Promise<HealthResult> {
  try {
    const res = await fetchWithTimeout("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": apiKey, accept: "application/json" },
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function pingAnthropic(apiKey: string): Promise<HealthResult> {
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        accept: "application/json",
      },
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function pingOpenAI(apiKey: string): Promise<HealthResult> {
  try {
    const res = await fetchWithTimeout("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function pingMeta(accessToken: string): Promise<HealthResult> {
  try {
    const res = await fetchWithTimeout(
      `https://graph.facebook.com/v20.0/me?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function pingTikTok(accessToken: string): Promise<HealthResult> {
  try {
    const res = await fetchWithTimeout(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id",
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, error: `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function pingHiggsfield(apiToken: string): Promise<HealthResult> {
  // The Higgsfield Cloud API base URL & exact "me" endpoint will be confirmed
  // when we wire the real client in Phase 3. For now we validate the token is non-empty.
  // TODO(phase-3): replace with a real GET /me or /account call.
  if (apiToken.length < 8) return { ok: false, error: "Token looks too short to be valid." };
  return { ok: true };
}

export async function runHealthCheck(
  provider: IntegrationProvider,
  secret: string,
): Promise<HealthResult> {
  switch (provider) {
    case "elevenlabs":
      return pingElevenLabs(secret);
    case "anthropic":
      return pingAnthropic(secret);
    case "openai":
      return pingOpenAI(secret);
    case "meta":
      return pingMeta(secret);
    case "tiktok":
      return pingTikTok(secret);
    case "higgsfield":
      return pingHiggsfield(secret);
  }
}
