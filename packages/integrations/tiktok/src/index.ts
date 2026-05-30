import { IntegrationError, NotConfiguredError } from "@crealify/shared";

export type TikTokConfig = {
  accessToken: string;
  openId?: string;
};

export type TikTokPrivacy =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "SELF_ONLY"
  | "FOLLOWER_OF_CREATOR";

export type TikTokDirectPostInput = {
  videoUrl: string;
  title: string;
  privacy?: TikTokPrivacy;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  brandContentToggle?: boolean;
  brandOrganicToggle?: boolean;
};

export type TikTokDirectPostResult = {
  publishId: string;
  status:
    | "PROCESSING_UPLOAD"
    | "PROCESSING_DOWNLOAD"
    | "SEND_TO_USER_INBOX"
    | "PUBLISH_COMPLETE"
    | "FAILED";
  shareUrl: string | null;
  publishedPostId: string | null;
};

export const TIKTOK_DEFAULT_BASE = "https://open.tiktokapis.com/v2";
const TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 120; // 10 min

/**
 * TikTok Content Posting API client. Uses the PULL_FROM_URL flow:
 * TikTok fetches the video from our R2 URL, processes it, and publishes
 * to the user's feed.
 */
export class TikTokClient {
  constructor(private readonly config: TikTokConfig) {
    if (!config.accessToken) throw new NotConfiguredError("tiktok");
  }

  async ping(): Promise<{ ok: true }> {
    const res = await this.request("GET", "/user/info/?fields=open_id");
    if (!res.ok) throw await this.toError("ping", res);
    return { ok: true };
  }

  async postVideo(input: TikTokDirectPostInput): Promise<TikTokDirectPostResult> {
    // 1. INIT.
    const initBody = {
      post_info: {
        title: input.title,
        privacy_level: input.privacy ?? "PUBLIC_TO_EVERYONE",
        disable_comment: input.disableComment ?? false,
        disable_duet: input.disableDuet ?? false,
        disable_stitch: input.disableStitch ?? false,
        brand_content_toggle: input.brandContentToggle ?? false,
        brand_organic_toggle: input.brandOrganicToggle ?? false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: input.videoUrl,
      },
    };
    const initRes = await this.request("POST", "/post/publish/video/init/", initBody);
    if (!initRes.ok) throw await this.toError("init", initRes);
    const initData = (await initRes.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };
    const publishId = initData.data?.publish_id;
    if (!publishId) {
      throw new IntegrationError(
        "tiktok",
        `INIT returned no publish_id: ${initData.error?.message ?? "unknown"}`,
      );
    }

    // 2. Poll status.
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await sleep(POLL_INTERVAL_MS);
      const statusRes = await this.request(
        "POST",
        "/post/publish/status/fetch/",
        { publish_id: publishId },
      );
      if (!statusRes.ok) {
        if (statusRes.status >= 500) continue;
        throw await this.toError("statusFetch", statusRes);
      }
      const statusData = (await statusRes.json()) as {
        data?: {
          status?: TikTokDirectPostResult["status"];
          publicaly_available_post_id?: string;
          publish_id?: string;
          share_url?: string;
          fail_reason?: string;
        };
      };
      const status = statusData.data?.status;
      if (!status) continue;
      if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
        return {
          publishId,
          status,
          shareUrl: statusData.data?.share_url ?? null,
          publishedPostId: statusData.data?.publicaly_available_post_id ?? null,
        };
      }
      if (status === "FAILED") {
        throw new IntegrationError(
          "tiktok",
          `Publish ${publishId} failed: ${statusData.data?.fail_reason ?? "unknown"}`,
        );
      }
    }
    throw new IntegrationError("tiktok", `Publish ${publishId} polling timed out`);
  }

  // -- internals ------------------------------------------------------------

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const url = `${TIKTOK_DEFAULT_BASE}${path}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        signal: ctl.signal,
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          ...(body ? { "content-type": "application/json; charset=UTF-8" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async toError(label: string, res: Response): Promise<IntegrationError> {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string; code?: string } };
      detail = body.error?.message ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    return new IntegrationError(
      "tiktok",
      `${label}: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`,
      res.status,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
