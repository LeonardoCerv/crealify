"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type PreviewClip = {
  id: string;
  url: string | null;
  posterUrl: string | null;
  durationSec: number;
};

type Props = {
  clips: PreviewClip[];
  aspect: "9:16" | "1:1" | "16:9";
  playheadSec: number;
  isPlaying: boolean;
  onPlayheadChange: (sec: number) => void;
  onPlayingChange: (playing: boolean) => void;
};

const ASPECT_RATIOS: Record<Props["aspect"], number> = {
  "9:16": 9 / 16,
  "1:1": 1,
  "16:9": 16 / 9,
};

export function ComposerPreview({
  clips,
  aspect,
  playheadSec,
  isPlaying,
  onPlayheadChange,
  onPlayingChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const layout = useMemo(() => {
    let cursor = 0;
    return clips.map((c) => {
      const start = cursor;
      const end = cursor + c.durationSec;
      cursor = end;
      return { ...c, startSec: start, endSec: end };
    });
  }, [clips]);

  const totalSec = layout.length ? layout[layout.length - 1]!.endSec : 0;
  const clampedPlayhead = Math.max(0, Math.min(playheadSec, totalSec));

  const activeIndex = useMemo(() => {
    if (layout.length === 0) return -1;
    if (clampedPlayhead >= totalSec) return layout.length - 1;
    return layout.findIndex((c) => clampedPlayhead >= c.startSec && clampedPlayhead < c.endSec);
  }, [layout, clampedPlayhead, totalSec]);

  const active = activeIndex >= 0 ? layout[activeIndex] : null;
  const localTime = active ? clampedPlayhead - active.startSec : 0;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active?.url) return;
    if (v.dataset.activeClipId !== active.id) {
      v.dataset.activeClipId = active.id;
      v.src = active.url;
      v.currentTime = Math.max(0, localTime);
      if (isPlaying) v.play().catch(() => undefined);
    } else if (Math.abs(v.currentTime - localTime) > 0.3) {
      v.currentTime = localTime;
    }
  }, [active, localTime, isPlaying]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.play().catch(() => undefined);
    else v.pause();
  }, [isPlaying]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    function onTime() {
      if (!v || !active) return;
      onPlayheadChange(active.startSec + v.currentTime);
    }
    function onEnded() {
      if (!active) return;
      const nextIdx = activeIndex + 1;
      if (nextIdx >= layout.length) {
        onPlayingChange(false);
        return;
      }
      const next = layout[nextIdx];
      if (next) onPlayheadChange(next.startSec);
    }
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [active, activeIndex, layout, onPlayheadChange, onPlayingChange]);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setStageBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => {
    const { w, h } = stageBox;
    if (w <= 0 || h <= 0) return { width: 0, height: 0 };
    const padding = 24;
    const availW = w - padding;
    const availH = h - padding;
    const ratio = ASPECT_RATIOS[aspect];
    const byW = { width: availW, height: availW / ratio };
    if (byW.height <= availH) return byW;
    return { width: availH * ratio, height: availH };
  }, [stageBox, aspect]);

  return (
    <div
      ref={stageRef}
      className="relative flex-1 overflow-hidden bg-[#0b0b0e]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(74, 140, 255, 0.05), transparent 60%)",
      }}
    >
      {layout.length === 0 ? (
        <EmptyStage />
      ) : (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-black shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/5"
          style={{ width: fit.width, height: fit.height }}
        >
          {active?.url ? (
            <video
              ref={videoRef}
              preload="auto"
              playsInline
              className="h-full w-full bg-black"
            />
          ) : active?.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.posterUrl} alt="" className="h-full w-full object-cover opacity-60" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[11px] text-zinc-500">
              no source
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyStage() {
  return (
    <div className="absolute inset-0 grid place-items-center text-center text-[12px] text-zinc-500">
      <div>
        <p className="mb-1 font-medium text-zinc-300">Empty preview</p>
        <p>Drag a block onto the timeline below.</p>
      </div>
    </div>
  );
}
