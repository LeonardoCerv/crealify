import { IntegrationError, NotConfiguredError } from "@crealify/shared";

export type HiggsfieldConfig = {
  apiToken: string;
  baseUrl?: string;
};

export type SoulTrainInput = {
  name: string;
  imageUrls: string[];
};
export type SoulTrainResult = { soulId: string };

export type SoulImageGenInput = {
  soulId: string;
  prompt: string;
  preset?: string;
  aspect: "9:16" | "1:1" | "16:9";
  seed?: number;
};
export type SoulImageGenResult = { imageUrl: string; jobId: string };

export type LipsyncModel =
  | "lipsync-2"
  | "kling-avatar"
  | "infinite-talk"
  | "veo-3"
  | "speak-v2";

export type LipsyncInput = {
  modelId: LipsyncModel;
  portraitImageUrl: string;
  audioUrl: string;
  aspect: "9:16" | "1:1" | "16:9";
  seed?: number;
};
export type LipsyncResult = { videoUrl: string; jobId: string; durationMs: number };

export type DopVariant = "dop-lite" | "dop-turbo" | "dop-preview";

export type DopInput = {
  startImageUrl: string;
  endImageUrl?: string;
  motionId?: string;
  prompt?: string;
  variant: DopVariant;
  aspect: "9:16" | "1:1" | "16:9";
  seed?: number;
};
export type DopResult = { videoUrl: string; jobId: string; durationMs: number };

export type MotionControlInput = {
  referenceVideoUrl: string;
  soulId: string;
  aspect: "9:16" | "1:1" | "16:9";
};
export type MotionControlResult = { videoUrl: string; jobId: string; durationMs: number };

export type ViralityScoreInput = { script: string; hook?: string };
export type ViralityScoreResult = { score: number; reasoning: string };

export const HIGGSFIELD_DEFAULT_BASE = "https://api.higgsfield.ai";
const HIGGSFIELD_VERSION = "v1";

const DEFAULT_TIMEOUT_MS = 30_000;

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

type RawJob = {
  id: string;
  status: JobStatus;
  output?: {
    url?: string;
    image_url?: string;
    video_url?: string;
    duration_ms?: number;
  };
  error?: { message?: string };
};

/**
 * Typed Higgsfield Cloud API client.
 *
 * The Higgsfield Cloud API isn't fully documented at the time of writing.
 * Routes follow the pattern `${baseUrl}/${version}/${product}/...` and are
 * collected in `ROUTES` below — once you have the official spec, update the
 * routes there and the payload shapes inside each method.
 */
export class HiggsfieldClient {
  private readonly baseUrl: string;

  constructor(private readonly config: HiggsfieldConfig) {
    if (!config.apiToken) throw new NotConfiguredError("higgsfield");
    this.baseUrl = (config.baseUrl ?? HIGGSFIELD_DEFAULT_BASE).replace(/\/$/, "");
  }

  // -- public surface -------------------------------------------------------

  async ping(): Promise<{ ok: true }> {
    const res = await this.request("GET", ROUTES.me);
    if (!res.ok) throw await this.toError("ping", res);
    return { ok: true };
  }

  async trainSoul(input: SoulTrainInput): Promise<SoulTrainResult> {
    const job = await this.submitAndPoll(ROUTES.soulTrain, {
      name: input.name,
      image_urls: input.imageUrls,
    });
    const soulId = (job as RawJob & { output?: { soul_id?: string } }).output?.soul_id;
    if (!soulId) throw new IntegrationError("higgsfield", "Soul training returned no soul_id");
    return { soulId };
  }

  async generateSoulImage(input: SoulImageGenInput): Promise<SoulImageGenResult> {
    const job = await this.submitAndPoll(ROUTES.soulImage, {
      soul_id: input.soulId,
      prompt: input.prompt,
      preset: input.preset,
      aspect_ratio: input.aspect,
      seed: input.seed,
    });
    const imageUrl = job.output?.image_url ?? job.output?.url;
    if (!imageUrl) throw new IntegrationError("higgsfield", "Soul image gen returned no output");
    return { imageUrl, jobId: job.id };
  }

  async generateLipsyncVideo(input: LipsyncInput): Promise<LipsyncResult> {
    const job = await this.submitAndPoll(ROUTES.lipsync, {
      model_id: input.modelId,
      portrait_image_url: input.portraitImageUrl,
      audio_url: input.audioUrl,
      aspect_ratio: input.aspect,
      seed: input.seed,
    });
    const videoUrl = job.output?.video_url ?? job.output?.url;
    if (!videoUrl) throw new IntegrationError("higgsfield", "Lipsync returned no video output");
    return {
      videoUrl,
      jobId: job.id,
      durationMs: job.output?.duration_ms ?? 0,
    };
  }

  async generateDopVideo(input: DopInput): Promise<DopResult> {
    const job = await this.submitAndPoll(ROUTES.dop, {
      variant: input.variant,
      start_image_url: input.startImageUrl,
      end_image_url: input.endImageUrl,
      motion_id: input.motionId,
      prompt: input.prompt,
      aspect_ratio: input.aspect,
      seed: input.seed,
    });
    const videoUrl = job.output?.video_url ?? job.output?.url;
    if (!videoUrl) throw new IntegrationError("higgsfield", "DoP returned no video output");
    return {
      videoUrl,
      jobId: job.id,
      durationMs: job.output?.duration_ms ?? 0,
    };
  }

  async motionControl(input: MotionControlInput): Promise<MotionControlResult> {
    const job = await this.submitAndPoll(ROUTES.motionControl, {
      reference_video_url: input.referenceVideoUrl,
      soul_id: input.soulId,
      aspect_ratio: input.aspect,
    });
    const videoUrl = job.output?.video_url ?? job.output?.url;
    if (!videoUrl) throw new IntegrationError("higgsfield", "Motion control returned no video");
    return {
      videoUrl,
      jobId: job.id,
      durationMs: job.output?.duration_ms ?? 0,
    };
  }

  async scoreVirality(input: ViralityScoreInput): Promise<ViralityScoreResult> {
    const job = await this.submitAndPoll(ROUTES.virality, {
      script: input.script,
      hook: input.hook,
    });
    const score = (job as RawJob & { output?: { score?: number; reasoning?: string } }).output;
    if (typeof score?.score !== "number") {
      throw new IntegrationError("higgsfield", "Virality scoring returned no score");
    }
    return { score: score.score, reasoning: score.reasoning ?? "" };
  }

  // -- internals ------------------------------------------------------------

  /**
   * Submit an async job to a Higgsfield endpoint, then poll it until it
   * reaches a terminal state. Returns the completed job. Used by every
   * generation method above.
   */
  private async submitAndPoll(
    route: string,
    payload: Record<string, unknown>,
    pollOpts: { intervalMs?: number; maxAttempts?: number } = {},
  ): Promise<RawJob> {
    const intervalMs = pollOpts.intervalMs ?? 4_000;
    const maxAttempts = pollOpts.maxAttempts ?? 150; // ~10 minutes default

    const submitRes = await this.request("POST", route, payload);
    if (!submitRes.ok) throw await this.toError(`submit ${route}`, submitRes);
    const submitted = (await submitRes.json()) as RawJob;
    if (!submitted.id) {
      throw new IntegrationError("higgsfield", `submit ${route} returned no job id`);
    }

    // If the API completed synchronously (some models do), short-circuit.
    if (submitted.status === "succeeded") return submitted;
    if (submitted.status === "failed" || submitted.status === "canceled") {
      throw new IntegrationError(
        "higgsfield",
        submitted.error?.message ?? `Job ${submitted.id} ${submitted.status}`,
      );
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(intervalMs);
      const pollRes = await this.request("GET", ROUTES.job(submitted.id));
      if (!pollRes.ok) {
        if (pollRes.status >= 500) continue;
        throw await this.toError(`poll ${submitted.id}`, pollRes);
      }
      const job = (await pollRes.json()) as RawJob;
      if (job.status === "succeeded") return job;
      if (job.status === "failed" || job.status === "canceled") {
        throw new IntegrationError(
          "higgsfield",
          job.error?.message ?? `Job ${submitted.id} ${job.status}`,
        );
      }
    }
    throw new IntegrationError(
      "higgsfield",
      `Job ${submitted.id} did not finish after ${maxAttempts} polls`,
    );
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const url = `${this.baseUrl}/${HIGGSFIELD_VERSION}${path}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        signal: ctl.signal,
        headers: {
          authorization: `Bearer ${this.config.apiToken}`,
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(stripUndefined(body)) : undefined,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async toError(label: string, res: Response): Promise<IntegrationError> {
    const text = await res.text().catch(() => "");
    return new IntegrationError(
      "higgsfield",
      `${label}: HTTP ${res.status}${text ? ` — ${text.slice(0, 300)}` : ""}`,
      res.status,
    );
  }
}

/**
 * Route table. Verify against the official Higgsfield Cloud API docs and
 * adjust paths as needed — these follow the conventions inferred from
 * https://cloud.higgsfield.ai/ and the documented MCP surface.
 */
const ROUTES = {
  me: "/account/me",
  soulTrain: "/soul/train",
  soulImage: "/soul/image",
  lipsync: "/lipsync/generate",
  dop: "/dop/generate",
  motionControl: "/motion-control/generate",
  virality: "/marketing/virality",
  job: (id: string) => `/jobs/${encodeURIComponent(id)}`,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o))
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}
