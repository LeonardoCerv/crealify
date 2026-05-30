"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeImportedVideoAction,
  mintImportUploadUrlAction,
  saveImportedSectionsAction,
  type AnalyzeResult,
} from "./actions";
import { TimelineEditor, type TimelineSection } from "./timeline-editor";

const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-matroska";

export function ImportPanel({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [sections, setSections] = useState<TimelineSection[]>([]);
  const [brief, setBrief] = useState("");
  const [hasBurnedCaptions, setHasBurnedCaptions] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const durationSec = analysis && analysis.ok ? analysis.durationSec : 0;

  async function onFile(file: File) {
    setMessage(null);
    setAnalysis(null);
    setSections([]);
    setVideoUrl(null);
    setProgress(0);
    const mint = await mintImportUploadUrlAction({
      contentType: file.type || "video/mp4",
      filename: file.name,
      byteSize: file.size,
    });
    if (!mint.ok) {
      setMessage({ ok: false, text: mint.error });
      setProgress(null);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", mint.uploadUrl);
      xhr.setRequestHeader("content-type", file.type || "video/mp4");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    }).then(
      () => {
        setVideoUrl(mint.publicUrl);
        setProgress(100);
      },
      (err: Error) => {
        setMessage({ ok: false, text: err.message });
        setProgress(null);
      },
    );
  }

  function onAnalyze() {
    if (!videoUrl) return;
    setMessage(null);
    startTransition(async () => {
      const res = await analyzeImportedVideoAction({ videoUrl, brief: brief || undefined });
      setAnalysis(res);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      const transcript = res.transcriptSegments;
      const rows: TimelineSection[] = res.sections.map((s) => {
        const text = transcript
          .filter((t) => t.endSec > s.startSec && t.startSec < s.endSec)
          .map((t) => t.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          slotType: s.slotType,
          label: s.label,
          startSec: round2(s.startSec),
          endSec: round2(s.endSec),
          text,
          rationale: s.rationale,
          selected: true,
        };
      });
      setSections(rows);
      setMessage({ ok: true, text: `Found ${rows.length} sections. Drag the boundaries to adjust.` });
    });
  }

  function onSave() {
    if (!videoUrl) return;
    const chosen = sections.filter((s) => s.selected);
    if (chosen.length === 0) {
      setMessage({ ok: false, text: "Pick at least one cut to save." });
      return;
    }
    startTransition(async () => {
      const res = await saveImportedSectionsAction({
        sourceVideoUrl: videoUrl,
        hasBurnedCaptions,
        sections: chosen.map((s) => ({
          slotType: s.slotType,
          label: s.label,
          startSec: s.startSec,
          endSec: s.endSec,
          text: s.text,
        })),
      });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: `Created ${res.createdBlockIds.length} blocks.` });
      router.push("/blocks");
      router.refresh();
    });
  }

  const selectedCount = sections.filter((s) => s.selected).length;

  return (
    <div className="space-y-6">
      {/* Step 1: upload */}
      <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="text-sm font-medium">1. Upload your video</h2>
        <div className="flex items-center gap-2 text-xs">
          <label
            className={`cursor-pointer rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-ink/70 ${
              !ready ? "pointer-events-none opacity-40" : "hover:bg-ink/5"
            }`}
          >
            {progress === null ? "Choose file" : "Replace…"}
            <input
              type="file"
              accept={ACCEPT}
              disabled={!ready}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
          {progress !== null && progress < 100 ? (
            <>
              <span className="text-ink/60">Uploading: {progress}%</span>
              <button
                type="button"
                onClick={() => xhrRef.current?.abort()}
                className="text-red-700 underline"
              >
                cancel
              </button>
            </>
          ) : progress === 100 && !sections.length ? (
            <span className="text-emerald-700">Uploaded ✓</span>
          ) : null}
        </div>
        <label className="flex items-start gap-2 text-xs text-ink/70">
          <input
            type="checkbox"
            checked={hasBurnedCaptions}
            onChange={(e) => setHasBurnedCaptions(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Source video already has captions burned in.{" "}
            <span className="text-ink/50">
              When on, Crealify won&apos;t add new captions on top during assembly. Recommended for
              most TikTok/Reels uploads.
            </span>
          </span>
        </label>
      </div>

      {/* Step 2: analyze */}
      {videoUrl && sections.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-sm font-medium">2. Analyze</h2>
          <label className="block text-xs">
            <span className="text-ink/70">Brief (optional, helps Claude make better cuts)</span>
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Crealify is an open-source video remixer for ad teams."
              maxLength={500}
              className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
            />
          </label>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!videoUrl || !ready || pending}
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
          >
            {pending ? "Analyzing…" : "Analyze"}
          </button>
          {message ? (
            <p className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Step 3: timeline edit */}
      {videoUrl && analysis?.ok && sections.length > 0 ? (
        <div className="space-y-4 rounded-lg border border-ink/10 bg-white p-5">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">2. Tweak the cuts</h2>
              <p className="text-[11px] text-ink/50">
                Drag the white handles to move boundaries. Double-click a section to preview it.
                Tick / untick sections to choose what to save.
              </p>
            </div>
            {message ? (
              <p className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
                {message.text}
              </p>
            ) : null}
          </header>

          <TimelineEditor
            videoUrl={videoUrl}
            durationSec={durationSec}
            sections={sections}
            onSectionsChange={setSections}
          />

          <div className="flex items-center gap-3 border-t border-ink/10 pt-4">
            <button
              type="button"
              onClick={onSave}
              disabled={pending || selectedCount === 0}
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper disabled:opacity-50"
            >
              {pending
                ? "Slicing…"
                : `Save ${selectedCount} block${selectedCount === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={onAnalyze}
              disabled={pending}
              className="rounded-full border border-ink/15 px-4 py-2 text-xs"
            >
              Re-analyze
            </button>
            <span className="ml-auto text-[11px] text-ink/40">
              Each cut becomes a reusable Block. Slicing happens server-side.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
