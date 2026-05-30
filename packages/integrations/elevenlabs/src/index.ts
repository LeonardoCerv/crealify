import { IntegrationError, NotConfiguredError } from "@crealify/shared";

export type ElevenLabsConfig = {
  apiKey: string;
  baseUrl?: string;
};

export type ListedVoice = {
  voiceId: string;
  name: string;
  previewUrl?: string;
  category?: string;
  labels?: Record<string, string>;
  language?: string;
};

export type ListVoicesResult = {
  voices: ListedVoice[];
};

export type TtsInput = {
  voiceId: string;
  text: string;
  modelId?: string;
  settings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
  };
};

export type TtsResult = { audio: Uint8Array; contentType: "audio/mpeg" };

export type SpeechToSpeechInput = {
  /** Target voice ID — the persona's ElevenLabs voice. */
  voiceId: string;
  /** Source audio bytes (mp3/wav/etc.). */
  audio: Buffer | Uint8Array;
  contentType: string;
  filename?: string;
  modelId?: string;
  /** Optional: preserve more of the source's emotion/prosody. */
  settings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
    removeBackgroundNoise?: boolean;
  };
};

export type SpeechToSpeechResult = { audio: Uint8Array; contentType: "audio/mpeg" };

export type TranscribeInput = {
  audio: Buffer | Uint8Array;
  contentType: string;
  filename?: string;
  modelId?: "scribe_v1" | "scribe_v1_experimental";
  languageCode?: string;
  diarize?: boolean;
};

export type TranscribeSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscribeResult = {
  language: string | null;
  fullText: string;
  durationSec: number;
  segments: TranscribeSegment[];
};

export const ELEVENLABS_DEFAULT_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_STT_MODEL = "scribe_v1";
const DEFAULT_STS_MODEL = "eleven_multilingual_sts_v2";

type RawVoice = {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string;
  fine_tuning?: { language?: string };
  verified_languages?: Array<{ language?: string; locale?: string }>;
};

type RawWord = {
  text: string;
  start?: number;
  end?: number;
  type?: "word" | "spacing" | "audio_event";
  speaker_id?: string | null;
};

type RawSttResponse = {
  language_code?: string;
  language_probability?: number;
  text?: string;
  words?: RawWord[];
};

export class ElevenLabsClient {
  private readonly baseUrl: string;

  constructor(private readonly config: ElevenLabsConfig) {
    if (!config.apiKey) throw new NotConfiguredError("elevenlabs");
    this.baseUrl = (config.baseUrl ?? ELEVENLABS_DEFAULT_BASE).replace(/\/$/, "");
  }

  async ping(): Promise<{ ok: true }> {
    const res = await this.request("GET", "/user");
    if (!res.ok) throw await this.toError("ping", res);
    return { ok: true };
  }

  async listVoices(): Promise<ListVoicesResult> {
    const res = await this.request("GET", "/voices");
    if (!res.ok) throw await this.toError("listVoices", res);
    const data = (await res.json()) as { voices?: RawVoice[] };
    return {
      voices: (data.voices ?? []).map((v) => {
        const language =
          v.fine_tuning?.language ??
          v.verified_languages?.[0]?.language ??
          v.labels?.language;
        return {
          voiceId: v.voice_id,
          name: v.name,
          previewUrl: v.preview_url,
          category: v.category,
          labels: v.labels,
          language,
        };
      }),
    };
  }

  /**
   * Transcribe an audio buffer with ElevenLabs Scribe. Scribe returns
   * word-level timing; we group consecutive words into utterance-level
   * segments by punctuation + silence gap so the segments are useful as
   * input to a section-boundary LLM call.
   */
  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    const form = new FormData();
    const buffer = input.audio instanceof Buffer ? input.audio : Buffer.from(input.audio);
    const blob = new Blob([new Uint8Array(buffer)], { type: input.contentType });
    form.set("file", blob, input.filename ?? "audio.mp3");
    form.set("model_id", input.modelId ?? DEFAULT_STT_MODEL);
    if (input.languageCode) form.set("language_code", input.languageCode);
    if (input.diarize) form.set("diarize", "true");

    const url = `${this.baseUrl}/speech-to-text`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal: ctl.signal,
        headers: { "xi-api-key": this.config.apiKey },
        body: form,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw await this.toError("transcribe", res);
    const data = (await res.json()) as RawSttResponse;
    const fullText = data.text ?? "";
    const segments = groupWordsIntoSegments(data.words ?? []);
    const durationSec = segments[segments.length - 1]?.endSec ?? 0;
    return {
      fullText,
      language: data.language_code ?? null,
      durationSec,
      segments,
    };
  }

  async synthesize(input: TtsInput): Promise<TtsResult> {
    const path = `/text-to-speech/${encodeURIComponent(input.voiceId)}`;
    const body: Record<string, unknown> = {
      text: input.text,
      model_id: input.modelId ?? DEFAULT_MODEL_ID,
    };
    if (input.settings) {
      body.voice_settings = {
        stability: input.settings.stability,
        similarity_boost: input.settings.similarityBoost,
        style: input.settings.style,
        use_speaker_boost: input.settings.speakerBoost,
      };
    }
    const res = await this.request("POST", path, body, "audio/mpeg");
    if (!res.ok) throw await this.toError("synthesize", res);
    const ab = await res.arrayBuffer();
    return { audio: new Uint8Array(ab), contentType: "audio/mpeg" };
  }

  /**
   * Speech-to-Speech: convert spoken audio into a different voice while
   * preserving prosody, pacing, and emotion. Multipart form upload, returns
   * mp3 bytes. Used by the persona swap on imported clips so the new voice
   * matches the original delivery exactly.
   */
  async speechToSpeech(input: SpeechToSpeechInput): Promise<SpeechToSpeechResult> {
    const path = `/speech-to-speech/${encodeURIComponent(input.voiceId)}`;
    const form = new FormData();
    const buffer = input.audio instanceof Buffer ? input.audio : Buffer.from(input.audio);
    const blob = new Blob([new Uint8Array(buffer)], { type: input.contentType });
    form.set("audio", blob, input.filename ?? "source.mp3");
    form.set("model_id", input.modelId ?? DEFAULT_STS_MODEL);
    if (input.settings) {
      const vs: Record<string, unknown> = {};
      if (input.settings.stability !== undefined) vs.stability = input.settings.stability;
      if (input.settings.similarityBoost !== undefined)
        vs.similarity_boost = input.settings.similarityBoost;
      if (input.settings.style !== undefined) vs.style = input.settings.style;
      if (input.settings.speakerBoost !== undefined)
        vs.use_speaker_boost = input.settings.speakerBoost;
      if (Object.keys(vs).length) form.set("voice_settings", JSON.stringify(vs));
      if (input.settings.removeBackgroundNoise) form.set("remove_background_noise", "true");
    }

    const url = `${this.baseUrl}${path}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal: ctl.signal,
        headers: { "xi-api-key": this.config.apiKey, accept: "audio/mpeg" },
        body: form,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw await this.toError("speechToSpeech", res);
    const ab = await res.arrayBuffer();
    return { audio: new Uint8Array(ab), contentType: "audio/mpeg" };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
    accept = "application/json",
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), DEFAULT_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        signal: ctl.signal,
        headers: {
          "xi-api-key": this.config.apiKey,
          accept,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async toError(label: string, res: Response): Promise<IntegrationError> {
    const text = await res.text().catch(() => "");
    return new IntegrationError(
      "elevenlabs",
      `${label}: HTTP ${res.status}${text ? ` — ${text.slice(0, 300)}` : ""}`,
      res.status,
    );
  }
}

/**
 * Group Scribe's word-level timestamps into sentence-like utterance segments.
 * Breaks on: explicit sentence punctuation (.!?), silence gap ≥ 0.6s between
 * adjacent words, or after ~14 words to avoid runaway segments.
 */
function groupWordsIntoSegments(words: RawWord[]): TranscribeSegment[] {
  const segments: TranscribeSegment[] = [];
  let buf: RawWord[] = [];

  function flush() {
    if (buf.length === 0) return;
    const start = buf.find((w) => typeof w.start === "number")?.start ?? 0;
    const end = [...buf].reverse().find((w) => typeof w.end === "number")?.end ?? start;
    const text = buf
      .map((w) => w.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 0) segments.push({ startSec: start, endSec: end, text });
    buf = [];
  }

  let wordsInSegment = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w.type === "audio_event") continue;
    buf.push(w);
    if (w.type === "word") wordsInSegment++;
    const text = w.text.trim();
    const endsSentence = /[.!?]$/.test(text);
    const next = words[i + 1];
    const gap =
      typeof w.end === "number" && typeof next?.start === "number" ? next.start - w.end : 0;
    if (endsSentence || gap >= 0.6 || wordsInSegment >= 14) {
      flush();
      wordsInSegment = 0;
    }
  }
  flush();
  return segments;
}
