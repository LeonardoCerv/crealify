import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import ffmpeg from "fluent-ffmpeg";

/**
 * Locate the ffmpeg binary at runtime.
 *
 * Order of preference:
 *   1. `FFMPEG_PATH` env var (explicit override — recommended in prod).
 *   2. pnpm layout: `<root>/node_modules/.pnpm/@ffmpeg-installer+<plat>@*` → walk up from cwd.
 *   3. npm/yarn layout: `<root>/node_modules/@ffmpeg-installer/<plat>` → walk up from cwd.
 *   4. System PATH: `ffmpeg` (last resort).
 *
 * This avoids the bundling pitfall where `createRequire(import.meta.url)`
 * resolves from the bundled chunk's location instead of the original package.
 */
function locateFfmpegBinary(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  const plat = `${process.platform}-${process.arch}`;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const nm = join(dir, "node_modules");
    if (existsSync(nm)) {
      // pnpm layout
      const pnpmDir = join(nm, ".pnpm");
      if (existsSync(pnpmDir)) {
        const prefix = `@ffmpeg-installer+${plat}@`;
        const entries = readdirSync(pnpmDir).filter((d) => d.startsWith(prefix));
        for (const entry of entries) {
          const candidate = join(
            pnpmDir,
            entry,
            "node_modules",
            "@ffmpeg-installer",
            plat,
            "ffmpeg",
          );
          if (existsSync(candidate)) return candidate;
        }
      }
      // npm / yarn layout
      const plain = join(nm, "@ffmpeg-installer", plat, "ffmpeg");
      if (existsSync(plain)) return plain;
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  // System PATH fallback.
  return "ffmpeg";
}

ffmpeg.setFfmpegPath(locateFfmpegBinary());

export type AspectRatio = "9:16" | "1:1" | "16:9";

const DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

/**
 * Run an ffmpeg command and resolve when it finishes. Wraps fluent-ffmpeg's
 * event API in a promise.
 */
function run(cmd: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    cmd
      .on("error", (err) => reject(new Error(`ffmpeg: ${err.message}`)))
      .on("end", () => resolve())
      .run();
  });
}

export type Clip = {
  /** Remote URL to download. */
  url: string;
  /** Optional caption to burn into the bottom third of the clip. */
  caption?: string;
};

export type ConcatInput = {
  /** Ordered list of remote URLs to download and concat in order. */
  urls: string[];
  /** Target aspect ratio for the output. Inputs are scaled/letterboxed to fit. */
  aspect: AspectRatio;
  /** Optional override of target bitrate (e.g. "4000k"). */
  videoBitrate?: string;
};

export type CaptionedConcatInput = {
  clips: Clip[];
  aspect: AspectRatio;
  videoBitrate?: string;
};

export type ConcatResult = {
  buffer: Buffer;
  durationSec: number;
  contentType: "video/mp4";
};

/**
 * Download each remote MP4, scale to the target aspect, then concat with the
 * concat demuxer. The simplest possible assembly pass — good enough for v1
 * "play these N clips back-to-back." Captions / transitions land in Phase 3.5
 * via Remotion.
 */
export async function concatRemoteUrls(input: ConcatInput): Promise<ConcatResult> {
  if (input.urls.length === 0) throw new Error("concatRemoteUrls: at least one URL required");
  const dims = DIMENSIONS[input.aspect];
  const workdir = await mkdtemp(join(tmpdir(), "crealify-concat-"));
  try {
    const sourcePaths: string[] = [];
    for (let i = 0; i < input.urls.length; i++) {
      const url = input.urls[i]!;
      const raw = await fetchToBuffer(url);
      const src = join(workdir, `src-${i}.mp4`);
      await writeFile(src, raw);
      sourcePaths.push(src);
    }

    // First pass: normalize each input to the target aspect/codec so the
    // concat demuxer can stitch without re-encoding mismatches.
    const normalized: string[] = [];
    for (let i = 0; i < sourcePaths.length; i++) {
      const src = sourcePaths[i]!;
      const out = join(workdir, `norm-${i}.mp4`);
      const cmd = ffmpeg(src)
        .videoFilters([
          `scale=w=${dims.width}:h=${dims.height}:force_original_aspect_ratio=decrease`,
          `pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
          "setsar=1",
        ])
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-r 30",
          "-movflags +faststart",
          "-preset veryfast",
          `-b:v ${input.videoBitrate ?? "4000k"}`,
          "-ar 48000",
          "-b:a 192k",
        ])
        .output(out);
      await run(cmd);
      normalized.push(out);
    }

    // Second pass: concat demuxer.
    const listFile = join(workdir, "concat.txt");
    await writeFile(
      listFile,
      normalized.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    );
    const final = join(workdir, "out.mp4");
    const concatCmd = ffmpeg()
      .input(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy", "-movflags +faststart"])
      .output(final);
    await run(concatCmd);

    const { buffer, durationSec } = await readWithDuration(final);
    return { buffer, durationSec, contentType: "video/mp4" };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Probe duration via ffprobe. */
function probeDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return reject(err);
      const dur = data.format?.duration;
      resolve(typeof dur === "number" ? dur : 0);
    });
  });
}

async function readWithDuration(path: string): Promise<{ buffer: Buffer; durationSec: number }> {
  const { readFile } = await import("node:fs/promises");
  const [buffer, durationSec] = await Promise.all([readFile(path), probeDuration(path)]);
  return { buffer, durationSec };
}

/**
 * Like {@link concatRemoteUrls} but burns the caption text from each clip
 * into the bottom-third of that clip before concatenating. Captions are
 * written as SRT covering the full clip duration — good enough for a
 * single-line teleprompter-style burn. Multi-line word-aligned captions
 * land in v1.1 (Whisper alignment + word-level timing).
 */
export async function concatCaptionedRemoteUrls(
  input: CaptionedConcatInput,
): Promise<ConcatResult> {
  if (input.clips.length === 0) {
    throw new Error("concatCaptionedRemoteUrls: at least one clip required");
  }
  const dims = DIMENSIONS[input.aspect];
  const workdir = await mkdtemp(join(tmpdir(), "crealify-captioned-"));
  try {
    // 1. Download each clip.
    const sourcePaths: string[] = [];
    for (let i = 0; i < input.clips.length; i++) {
      const clip = input.clips[i]!;
      const src = join(workdir, `src-${i}.mp4`);
      await writeFile(src, await fetchToBuffer(clip.url));
      sourcePaths.push(src);
    }

    // 2. Normalize + burn caption per clip.
    const normalized: string[] = [];
    for (let i = 0; i < sourcePaths.length; i++) {
      const src = sourcePaths[i]!;
      const clip = input.clips[i]!;
      const out = join(workdir, `norm-${i}.mp4`);
      const duration = await probeDuration(src);

      const filters = [
        `scale=w=${dims.width}:h=${dims.height}:force_original_aspect_ratio=decrease`,
        `pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        "setsar=1",
      ];

      if (clip.caption && clip.caption.trim().length > 0) {
        const srtPath = join(workdir, `caption-${i}.srt`);
        await writeFile(srtPath, buildSrt(clip.caption, Math.max(0.5, duration || 5)));
        // ffmpeg's subtitles filter wants the path as a single argument; it parses
        // SRT and renders styled text. We force a high-contrast style for short-form.
        filters.push(
          `subtitles=${ffmpegEscapePath(srtPath)}:force_style='${SRT_STYLE}'`,
        );
      }

      const cmd = ffmpeg(src)
        .videoFilters(filters)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-r 30",
          "-movflags +faststart",
          "-preset veryfast",
          `-b:v ${input.videoBitrate ?? "4000k"}`,
          "-ar 48000",
          "-b:a 192k",
        ])
        .output(out);
      await run(cmd);
      normalized.push(out);
    }

    // 3. Concat demuxer.
    const listFile = join(workdir, "concat.txt");
    await writeFile(
      listFile,
      normalized.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    );
    const final = join(workdir, "out.mp4");
    const concatCmd = ffmpeg()
      .input(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy", "-movflags +faststart"])
      .output(final);
    await run(concatCmd);

    const { buffer, durationSec } = await readWithDuration(final);
    return { buffer, durationSec, contentType: "video/mp4" };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const SRT_STYLE =
  "FontName=Inter,Fontsize=24,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=2,Shadow=0,MarginV=120,Alignment=2,Bold=1";

function buildSrt(text: string, durationSec: number): string {
  // Split on sentence boundaries and distribute evenly across the duration.
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return "";
  const slice = durationSec / sentences.length;
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const start = i * slice;
    const end = Math.min((i + 1) * slice, durationSec);
    out.push(`${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${wrapForCaption(sentences[i]!)}\n`);
  }
  return out.join("\n");
}

function srtTime(sec: number): string {
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return (
    String(hh).padStart(2, "0") +
    ":" +
    String(mm).padStart(2, "0") +
    ":" +
    String(ss).padStart(2, "0") +
    "," +
    String(ms).padStart(3, "0")
  );
}

function wrapForCaption(text: string, perLine = 32): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let buf = "";
  for (const w of words) {
    if ((buf + " " + w).trim().length > perLine) {
      lines.push(buf.trim());
      buf = w;
    } else {
      buf = (buf + " " + w).trim();
    }
  }
  if (buf) lines.push(buf);
  // Cap to 2 lines for readability on vertical short-form.
  return lines.slice(0, 2).join("\n");
}

function ffmpegEscapePath(p: string): string {
  // The ffmpeg filter graph treats ':', '\\', '\'' specially. On POSIX paths the
  // colon in things like "/tmp/..." is fine, but Windows drive letters are not —
  // we don't support Windows in the worker (Docker is Linux), so a minimal escape
  // for backslashes + single quotes is enough.
  return p.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export type ProbedMedia = {
  durationSec: number;
  width: number | null;
  height: number | null;
};

/** Probe a remote video URL for duration + dimensions. */
export async function probeRemoteUrl(url: string): Promise<ProbedMedia> {
  const workdir = await mkdtemp(join(tmpdir(), "crealify-probe-"));
  try {
    const src = join(workdir, "src");
    await writeFile(src, await fetchToBuffer(url));
    const info = await probeFile(src);
    const video = info.streams.find((s) => s.codec_type === "video");
    return {
      durationSec: typeof info.format?.duration === "number" ? info.format.duration : 0,
      width: video?.width ?? null,
      height: video?.height ?? null,
    };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function probeFile(path: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/**
 * Extract the audio track of a remote video as 16 kHz mono MP3 — the format
 * OpenAI Whisper prefers and the cheapest to send over the wire.
 */
export async function extractAudioFromUrl(url: string): Promise<{
  buffer: Buffer;
  contentType: "audio/mpeg";
  durationSec: number;
}> {
  const workdir = await mkdtemp(join(tmpdir(), "crealify-audio-"));
  try {
    const src = join(workdir, "src");
    await writeFile(src, await fetchToBuffer(url));
    const out = join(workdir, "out.mp3");
    const cmd = ffmpeg(src)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate("64k")
      .format("mp3")
      .output(out);
    await run(cmd);
    const { buffer, durationSec } = await readWithDuration(out);
    return { buffer, contentType: "audio/mpeg", durationSec };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export type SliceInput = {
  url: string;
  startSec: number;
  endSec: number;
  aspect?: AspectRatio;
};

/**
 * Slice a sub-clip from a remote video at the given seconds. Stream-copy
 * (no re-encode) when no aspect change is requested — fastest. Re-encodes
 * if normalizing to a specific aspect ratio.
 */
export async function sliceVideoUrl(input: SliceInput): Promise<ConcatResult> {
  if (input.endSec <= input.startSec) {
    throw new Error(`sliceVideoUrl: endSec (${input.endSec}) must be > startSec (${input.startSec})`);
  }
  const duration = input.endSec - input.startSec;
  const workdir = await mkdtemp(join(tmpdir(), "crealify-slice-"));
  try {
    const src = join(workdir, "src");
    await writeFile(src, await fetchToBuffer(input.url));
    const out = join(workdir, "out.mp4");
    const cmd = ffmpeg(src)
      .setStartTime(input.startSec)
      .setDuration(duration);

    if (input.aspect) {
      const dims = DIMENSIONS[input.aspect];
      cmd
        .videoFilters([
          `scale=w=${dims.width}:h=${dims.height}:force_original_aspect_ratio=decrease`,
          `pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
          "setsar=1",
        ])
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions([
          "-pix_fmt yuv420p",
          "-r 30",
          "-movflags +faststart",
          "-preset veryfast",
          "-b:v 4000k",
          "-ar 48000",
          "-b:a 192k",
        ]);
    } else {
      // Fast path: stream-copy. Re-encode falls back automatically if codec
      // copy is incompatible (rare for typical uploads).
      cmd.outputOptions([
        "-c:v libx264",
        "-c:a aac",
        "-pix_fmt yuv420p",
        "-preset veryfast",
        "-movflags +faststart",
        "-avoid_negative_ts make_zero",
      ]);
    }

    cmd.output(out);
    await run(cmd);
    const { buffer, durationSec } = await readWithDuration(out);
    return { buffer, durationSec, contentType: "video/mp4" };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Capture a single JPEG poster frame from a video buffer at the given offset.
 * If the source is shorter than the offset, captures the last available frame.
 */
export async function capturePosterFromBuffer(
  videoBuffer: Buffer,
  atSec: number,
  maxWidth = 480,
): Promise<{ buffer: Buffer; contentType: "image/jpeg" }> {
  const workdir = await mkdtemp(join(tmpdir(), "crealify-poster-"));
  try {
    const src = join(workdir, "src.mp4");
    await writeFile(src, videoBuffer);
    const out = join(workdir, "poster.jpg");
    const cmd = ffmpeg(src)
      .seekInput(Math.max(0, atSec))
      .frames(1)
      .videoFilters([`scale=w='min(${maxWidth},iw)':h=-2`])
      .outputOptions(["-q:v 3"])
      .output(out);
    await run(cmd);
    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(out);
    return { buffer, contentType: "image/jpeg" };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Replace the audio track of a remote video with the given audio buffer.
 * Used by the Persona swap: original video stays, but the spoken voice is
 * the persona's. Video is stream-copied (no re-encode); audio is re-encoded
 * to AAC. Output duration matches the original video (audio is padded with
 * silence or trimmed as needed).
 */
export async function muxAudioOverUrl(input: {
  videoUrl: string;
  audio: Buffer | Uint8Array;
  audioContentType: string;
}): Promise<ConcatResult> {
  const workdir = await mkdtemp(join(tmpdir(), "crealify-mux-"));
  try {
    const videoPath = join(workdir, "src.mp4");
    await writeFile(videoPath, await fetchToBuffer(input.videoUrl));
    const audioPath = join(workdir, `src${guessExt(input.audioContentType)}`);
    await writeFile(audioPath, Buffer.from(input.audio));

    const out = join(workdir, "out.mp4");
    const cmd = ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-map 0:v:0",
        "-map 1:a:0",
        "-c:v copy",
        "-c:a aac",
        "-b:a 192k",
        "-ar 48000",
        "-shortest",
        "-movflags +faststart",
      ])
      .output(out);
    await run(cmd);

    const { buffer, durationSec } = await readWithDuration(out);
    return { buffer, durationSec, contentType: "video/mp4" };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function guessExt(contentType: string): string {
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return ".mp3";
  if (contentType.includes("wav")) return ".wav";
  if (contentType.includes("ogg")) return ".ogg";
  if (contentType.includes("m4a") || contentType.includes("aac")) return ".m4a";
  return ".bin";
}

/** Re-encode a video to a target aspect ratio. Used to normalize uploaded assets. */
export async function transcodeToAspect(
  url: string,
  aspect: AspectRatio,
): Promise<ConcatResult> {
  const dims = DIMENSIONS[aspect];
  const workdir = await mkdtemp(join(tmpdir(), "crealify-transcode-"));
  try {
    const src = join(workdir, "src.mp4");
    await writeFile(src, await fetchToBuffer(url));
    const out = join(workdir, "out.mp4");
    const cmd = ffmpeg(src)
      .videoFilters([
        `scale=w=${dims.width}:h=${dims.height}:force_original_aspect_ratio=decrease`,
        `pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        "setsar=1",
      ])
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-pix_fmt yuv420p",
        "-r 30",
        "-movflags +faststart",
        "-preset veryfast",
        "-b:v 4000k",
        "-ar 48000",
        "-b:a 192k",
      ])
      .output(out);
    await run(cmd);
    const { buffer, durationSec } = await readWithDuration(out);
    return { buffer, durationSec, contentType: "video/mp4" };
  } finally {
    await rm(workdir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/** Convenience: write a Readable to a file. */
export async function pipeToFile(stream: Readable, path: string): Promise<void> {
  const { createWriteStream } = await import("node:fs");
  const { pipeline } = await import("node:stream/promises");
  await pipeline(stream, createWriteStream(path));
}
