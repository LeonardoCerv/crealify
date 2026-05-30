"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  getRenderStatusAction,
  retryBlockRenderAction,
  startVideoRenderAction,
  type RenderStatusSnapshot,
} from "./render-actions";

type Props = {
  videoId: string;
  initial: RenderStatusSnapshot;
};

const STATUS_STYLES: Record<RenderStatusSnapshot["slots"][number]["status"], string> = {
  missing: "bg-ink/5 text-ink/50",
  pending: "bg-amber-50 text-amber-800",
  running: "bg-amber-100 text-amber-900",
  succeeded: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-700",
};

export function RenderPanel({ videoId, initial }: Props) {
  const [snapshot, setSnapshot] = useState<RenderStatusSnapshot>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isPolling =
    snapshot.videoStatus === "rendering" ||
    snapshot.slots.some((s) => s.status === "pending" || s.status === "running");

  const tick = useCallback(async () => {
    const next = await getRenderStatusAction(videoId);
    if (next) setSnapshot(next);
  }, [videoId]);

  useEffect(() => {
    if (!isPolling) return;
    const id = setInterval(tick, 4_000);
    return () => clearInterval(id);
  }, [isPolling, tick]);

  function onRender() {
    setMessage(null);
    startTransition(async () => {
      const res = await startVideoRenderAction(videoId);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: "Render queued." });
      await tick();
    });
  }

  function onRetry(blockId: string) {
    startTransition(async () => {
      const res = await retryBlockRenderAction(videoId, blockId);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: "Retry queued." });
      await tick();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-ink/10 bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Render</h2>
          <p className="text-[11px] text-ink/50">
            Status: <span className="font-mono">{snapshot.videoStatus}</span>
            {isPolling ? " · live polling" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onRender}
          disabled={pending || isPolling}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
        >
          {pending ? "Queuing…" : isPolling ? "Rendering…" : "Render"}
        </button>
      </header>

      {message ? (
        <p className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
          {message.text}
        </p>
      ) : null}

      <ol className="space-y-2">
        {snapshot.slots.map((slot, idx) => (
          <li key={slot.slotId} className="rounded-md border border-ink/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  <span className="font-mono text-ink/40">#{idx + 1}</span> {slot.blockName}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">
                  slot: {slot.slotId}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLES[slot.status]}`}
              >
                {slot.status}
              </span>
              {slot.status === "failed" ? (
                <button
                  type="button"
                  onClick={() => onRetry(slot.blockId)}
                  className="rounded-full border border-ink/15 px-2.5 py-0.5 text-[10px]"
                >
                  Retry
                </button>
              ) : null}
            </div>
            {slot.error ? (
              <p className="mt-2 line-clamp-3 text-[11px] text-red-700">{slot.error}</p>
            ) : null}
            {slot.assetUrl && slot.status === "succeeded" ? (
              <video
                src={slot.assetUrl}
                controls
                preload="metadata"
                className="mt-2 max-h-32 rounded-md border border-ink/10"
              />
            ) : null}
          </li>
        ))}
      </ol>

      {snapshot.finalAssetUrl ? (
        <div className="space-y-2 border-t border-ink/10 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Final assembly</p>
            {snapshot.staleFinalAsset ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                Stale · re-render needed
              </span>
            ) : null}
          </div>
          {snapshot.staleFinalAsset ? (
            <p className="text-[11px] text-amber-800">
              A block was edited (or character/voice/aspect changed) since this MP4 was built. The
              preview below reflects the prior state — hit <strong>Render</strong> to rebuild with
              the current bindings.
            </p>
          ) : null}
          <video
            src={snapshot.finalAssetUrl}
            controls
            preload="metadata"
            className="aspect-[9/16] max-h-[480px] rounded-md border border-ink/10"
          />
          <a
            href={snapshot.finalAssetUrl}
            download
            className="inline-block text-[11px] text-ink/60 underline"
          >
            Download MP4
          </a>
        </div>
      ) : null}
    </div>
  );
}
