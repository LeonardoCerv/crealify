import { IntegrationError, NotConfiguredError } from "@crealify/shared";

export type MetaConfig = {
  accessToken: string;
  facebookPageId?: string;
  instagramBusinessId?: string;
};

export type FacebookPostInput = {
  videoUrl: string;
  caption: string;
};
export type FacebookPostResult = { postId: string; permalink: string | null };

export type InstagramReelInput = {
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
};
export type InstagramReelResult = { mediaId: string; permalink: string | null };

export const META_DEFAULT_BASE = "https://graph.facebook.com/v20.0";
const TIMEOUT_MS = 30_000;

type RawError = { error?: { message?: string; code?: number; type?: string } };

/**
 * Meta Graph API client. Implements:
 *  - Facebook page video posting via `file_url` (Meta fetches our R2 URL).
 *  - Instagram Reels two-step container/publish flow.
 */
export class MetaClient {
  constructor(private readonly config: MetaConfig) {
    if (!config.accessToken) throw new NotConfiguredError("meta");
  }

  async ping(): Promise<{ ok: true }> {
    const res = await this.request("GET", "/me", {});
    if (!res.ok) throw await this.toError("ping", res);
    return { ok: true };
  }

  async postFacebookVideo(input: FacebookPostInput): Promise<FacebookPostResult> {
    if (!this.config.facebookPageId) {
      throw new NotConfiguredError("meta:facebookPageId");
    }
    const res = await this.request("POST", `/${this.config.facebookPageId}/videos`, {
      file_url: input.videoUrl,
      description: input.caption,
    });
    if (!res.ok) throw await this.toError("postFacebookVideo", res);
    const data = (await res.json()) as { id?: string; post_id?: string };
    const postId = data.post_id ?? data.id;
    if (!postId) throw new IntegrationError("meta", "FB post returned no id");
    const permalink = await this.facebookPermalink(postId).catch(() => null);
    return { postId, permalink };
  }

  async postInstagramReel(input: InstagramReelInput): Promise<InstagramReelResult> {
    if (!this.config.instagramBusinessId) {
      throw new NotConfiguredError("meta:instagramBusinessId");
    }
    // 1. Create the container.
    const createRes = await this.request(
      "POST",
      `/${this.config.instagramBusinessId}/media`,
      {
        media_type: "REELS",
        video_url: input.videoUrl,
        caption: input.caption,
        share_to_feed: input.shareToFeed ?? true,
      },
    );
    if (!createRes.ok) throw await this.toError("createReelContainer", createRes);
    const created = (await createRes.json()) as { id?: string };
    if (!created.id) throw new IntegrationError("meta", "Reel container returned no id");
    const containerId = created.id;

    // 2. Poll container status until FINISHED.
    await this.pollContainer(containerId);

    // 3. Publish.
    const publishRes = await this.request(
      "POST",
      `/${this.config.instagramBusinessId}/media_publish`,
      { creation_id: containerId },
    );
    if (!publishRes.ok) throw await this.toError("publishReel", publishRes);
    const published = (await publishRes.json()) as { id?: string };
    if (!published.id) throw new IntegrationError("meta", "Reel publish returned no id");
    const mediaId = published.id;
    const permalink = await this.instagramPermalink(mediaId).catch(() => null);
    return { mediaId, permalink };
  }

  // -- internals ------------------------------------------------------------

  private async pollContainer(containerId: string): Promise<void> {
    const maxAttempts = 60; // 5 min @ 5s
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await this.request("GET", `/${containerId}`, { fields: "status_code" });
      if (!res.ok) {
        if (res.status >= 500) {
          await sleep(5_000);
          continue;
        }
        throw await this.toError("pollContainer", res);
      }
      const body = (await res.json()) as { status_code?: string };
      if (body.status_code === "FINISHED") return;
      if (body.status_code === "ERROR" || body.status_code === "EXPIRED") {
        throw new IntegrationError(
          "meta",
          `Reel container ${containerId} ${body.status_code}`,
        );
      }
      await sleep(5_000);
    }
    throw new IntegrationError("meta", `Reel container ${containerId} polling timed out`);
  }

  private async facebookPermalink(postId: string): Promise<string | null> {
    const res = await this.request("GET", `/${postId}`, { fields: "permalink_url" });
    if (!res.ok) return null;
    const body = (await res.json()) as { permalink_url?: string };
    return body.permalink_url ?? null;
  }

  private async instagramPermalink(mediaId: string): Promise<string | null> {
    const res = await this.request("GET", `/${mediaId}`, { fields: "permalink" });
    if (!res.ok) return null;
    const body = (await res.json()) as { permalink?: string };
    return body.permalink ?? null;
  }

  private buildUrl(path: string, query: Record<string, unknown>): string {
    const url = new URL(`${META_DEFAULT_BASE}${path}`);
    url.searchParams.set("access_token", this.config.accessToken);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    query: Record<string, unknown>,
  ): Promise<Response> {
    const url = this.buildUrl(path, query);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, { method, signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async toError(label: string, res: Response): Promise<IntegrationError> {
    let detail = "";
    try {
      const body = (await res.json()) as RawError;
      detail = body.error?.message ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    return new IntegrationError(
      "meta",
      `${label}: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`,
      res.status,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
