"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TimelineClip = {
  id: string;
  blockId: string;
  blockName: string;
  slotType: string;
  posterUrl: string | null;
  durationSec: number;
};

type Props = {
  clips: TimelineClip[];
  selectedIndex: number | null;
  playheadSec: number;
  pxPerSec: number;
  onSelect: (idx: number) => void;
  onRemove: (idx: number) => void;
  onPlayheadChange: (sec: number) => void;
  onAddFromLibrary: (blockId: string, atIdx: number) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onZoom: (pxPerSec: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  totalSec: number;
};

export const ZOOM_LEVELS = [8, 14, 22, 36, 60, 100];

const RULER_HEIGHT = 26;
const TRACK_HEIGHT = 70;
const TRACK_LABEL_WIDTH = 44;
const TRACK_PADDING_Y = 8;

const DT_BLOCK = "application/x-crealify-block-id";
const DT_TIMELINE = "application/x-crealify-timeline-index";

const SLOT_ACCENT: Record<string, string> = {
  opener: "bg-amber-400",
  problem: "bg-rose-400",
  solution: "bg-accent-400",
  demo: "bg-emerald-400",
  cta: "bg-orange-400",
  custom: "bg-zinc-400",
};
const accent = (slotType: string) => SLOT_ACCENT[slotType] ?? SLOT_ACCENT.custom!;

export function ComposerTimeline({
  clips,
  selectedIndex,
  playheadSec,
  pxPerSec,
  onSelect,
  onRemove,
  onPlayheadChange,
  onAddFromLibrary,
  onReorder,
  onZoom,
  isPlaying,
  onTogglePlay,
  totalSec,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [insertIdx, setInsertIdx] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const layout = useMemo(() => {
    let cursor = 0;
    return clips.map((c) => {
      const start = cursor;
      const widthPx = Math.max(56, c.durationSec * pxPerSec);
      cursor += c.durationSec;
      return { ...c, startSec: start, widthPx };
    });
  }, [clips, pxPerSec]);

  const contentWidth = Math.max(
    900,
    layout.reduce((w, c) => w + c.widthPx, 0) + 32,
  );

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !isPlaying) return;
    const playheadPx = playheadSec * pxPerSec;
    const viewport = scroll.clientWidth;
    const left = scroll.scrollLeft;
    const right = left + viewport;
    if (playheadPx < left + 80) scroll.scrollLeft = Math.max(0, playheadPx - 80);
    else if (playheadPx > right - 120) scroll.scrollLeft = playheadPx - viewport + 120;
  }, [playheadSec, pxPerSec, isPlaying]);

  function pxToSec(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(totalSec, x / pxPerSec));
  }

  function onRulerMouseDown(e: React.MouseEvent) {
    if (totalSec === 0) return;
    onPlayheadChange(pxToSec(e.clientX));
    setScrubbing(true);
  }
  useEffect(() => {
    if (!scrubbing) return;
    function onMove(e: MouseEvent) {
      onPlayheadChange(pxToSec(e.clientX));
    }
    function onUp() {
      setScrubbing(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubbing, pxPerSec, totalSec]);

  function indexAtClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return clips.length;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let cursor = 0;
    for (let i = 0; i < layout.length; i++) {
      const w = layout[i]!.widthPx;
      const mid = cursor + w / 2;
      if (x < mid) return i;
      cursor += w;
    }
    return clips.length;
  }

  function onTrackDragOver(e: React.DragEvent) {
    if (
      !e.dataTransfer.types.includes(DT_BLOCK) &&
      !e.dataTransfer.types.includes(DT_TIMELINE)
    )
      return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DT_TIMELINE) ? "move" : "copy";
    setInsertIdx(indexAtClientX(e.clientX));
  }

  function onTrackDrop(e: React.DragEvent) {
    e.preventDefault();
    const blockId = e.dataTransfer.getData(DT_BLOCK);
    const fromIdxRaw = e.dataTransfer.getData(DT_TIMELINE);
    const target = insertIdx ?? clips.length;
    if (blockId) {
      onAddFromLibrary(blockId, target);
    } else if (fromIdxRaw) {
      const fromIdx = Number(fromIdxRaw);
      if (Number.isInteger(fromIdx) && fromIdx !== target) {
        onReorder(fromIdx, target);
      }
    }
    setInsertIdx(null);
    setDraggingIdx(null);
  }

  function onTrackDragLeave(e: React.DragEvent) {
    if (e.currentTarget === e.target) setInsertIdx(null);
  }

  const tickEvery = chooseTickEvery(pxPerSec);
  const minorEvery = tickEvery / 5;
  const ticks: Array<{ sec: number; major: boolean }> = [];
  const tickEnd = Math.max(totalSec, 15);
  for (let t = 0; t <= tickEnd + 0.001; t += minorEvery) {
    const sec = Math.round(t * 1000) / 1000;
    const major = Math.abs(sec / tickEvery - Math.round(sec / tickEvery)) < 0.001;
    ticks.push({ sec, major });
  }

  const insertX = computeInsertX(layout, insertIdx);
  const playheadX = playheadSec * pxPerSec;

  return (
    <div className="flex h-full flex-col overflow-hidden border-t border-zinc-800 bg-zinc-900">
      <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={clips.length === 0}
            title={isPlaying ? "Pause (space)" : "Play (space)"}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-white hover:bg-accent-400 disabled:opacity-30"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <p className="font-mono text-[11px] tabular-nums">
            <span className="text-zinc-100">{formatTime(playheadSec)}</span>
            <span className="text-zinc-500"> / {formatTime(totalSec)}</span>
          </p>
        </div>
        <ZoomControls pxPerSec={pxPerSec} onZoom={onZoom} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex flex-col border-r border-zinc-800 bg-zinc-900 text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
          style={{ width: TRACK_LABEL_WIDTH }}
        >
          <div style={{ height: RULER_HEIGHT }} className="border-b border-zinc-800" />
          <div
            className="flex items-center justify-center"
            style={{ height: TRACK_HEIGHT + TRACK_PADDING_Y * 2 }}
          >
            V1
          </div>
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
          <div
            ref={trackRef}
            style={{ width: contentWidth }}
            onDragOver={onTrackDragOver}
            onDragLeave={onTrackDragLeave}
            onDrop={onTrackDrop}
            className="relative select-none"
          >
            <div
              onMouseDown={onRulerMouseDown}
              className="relative cursor-col-resize border-b border-zinc-800 bg-zinc-950"
              style={{ height: RULER_HEIGHT }}
            >
              {ticks.map((t, i) => (
                <div
                  key={i}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: t.sec * pxPerSec }}
                >
                  <div
                    className={`mx-auto w-px ${t.major ? "h-3 bg-zinc-500" : "h-1.5 bg-zinc-700"}`}
                  />
                  {t.major ? (
                    <span className="mt-0.5 block whitespace-nowrap font-mono text-[9px] tabular-nums text-zinc-400">
                      {formatTime(t.sec)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div
              className="relative bg-[#0a0a0d]"
              style={{
                height: TRACK_HEIGHT + TRACK_PADDING_Y * 2,
                paddingTop: TRACK_PADDING_Y,
                paddingBottom: TRACK_PADDING_Y,
              }}
            >
              <div className="pointer-events-none absolute inset-0">
                {ticks
                  .filter((t) => t.major)
                  .map((t, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full w-px bg-zinc-800/70"
                      style={{ left: t.sec * pxPerSec }}
                    />
                  ))}
              </div>

              {clips.length === 0 ? (
                <div className="grid h-full w-full place-items-center text-center text-[11px] text-zinc-500">
                  <p>Drop blocks here to start building.</p>
                </div>
              ) : (
                <div className="flex h-full items-stretch">
                  {layout.map((c, idx) => (
                    <ClipBlock
                      key={c.id}
                      clip={c}
                      index={idx}
                      selected={selectedIndex === idx}
                      dragging={draggingIdx === idx}
                      onSelect={() => {
                        onSelect(idx);
                        onPlayheadChange(c.startSec);
                      }}
                      onRemove={() => onRemove(idx)}
                      onDragStart={() => setDraggingIdx(idx)}
                      onDragEnd={() => {
                        setDraggingIdx(null);
                        setInsertIdx(null);
                      }}
                    />
                  ))}
                </div>
              )}

              {insertX != null ? (
                <div
                  className="pointer-events-none absolute top-0 z-30 h-full w-[2px] rounded bg-accent-400"
                  style={{ left: insertX, boxShadow: "0 0 12px rgba(74, 140, 255, 0.8)" }}
                />
              ) : null}

              <div
                className="pointer-events-none absolute z-20"
                style={{
                  left: playheadX - 6,
                  top: -RULER_HEIGHT,
                  height: TRACK_HEIGHT + TRACK_PADDING_Y * 2 + RULER_HEIGHT,
                }}
              >
                <div className="mx-auto h-3 w-3 rotate-45 bg-accent-400 shadow-[0_0_8px_rgba(74,140,255,0.8)]" />
                <div className="mx-auto h-full w-px bg-accent-400/90 shadow-[0_0_6px_rgba(74,140,255,0.55)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClipBlock({
  clip,
  index,
  selected,
  dragging,
  onSelect,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  clip: TimelineClip & { widthPx: number; startSec: number };
  index: number;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const a = accent(clip.slotType);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DT_TIMELINE, String(index));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative h-full shrink-0 overflow-hidden rounded-[6px] border transition ${
        selected
          ? "border-accent-400 shadow-[0_0_0_2px_rgba(74,140,255,0.45)]"
          : "border-zinc-700 hover:border-zinc-500"
      } ${dragging ? "opacity-40" : ""}`}
      style={{
        width: clip.widthPx,
        backgroundImage: clip.posterUrl ? `url(${cssUrl(clip.posterUrl)})` : undefined,
        backgroundColor: clip.posterUrl ? undefined : "#1a1a1f",
        backgroundSize: "auto 100%",
        backgroundRepeat: clip.posterUrl ? "repeat-x" : "no-repeat",
        backgroundPosition: "left center",
        cursor: "grab",
        marginRight: 2,
      }}
    >
      {/* Top accent strip */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${a}`} />

      {/* Subtle darkening overlay for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-black/20" />

      {/* Slot-type pill — top-left, bold so it's instantly readable */}
      <span
        className={`pointer-events-none absolute left-1.5 top-2 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${a} text-black`}
      >
        {clip.slotType}
      </span>

      {/* Duration — top-right */}
      <span className="pointer-events-none absolute right-1.5 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white">
        {clip.durationSec.toFixed(1)}s
      </span>

      {/* Remove button on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove clip"
        className="absolute right-1.5 bottom-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] text-white opacity-0 transition group-hover:opacity-100"
      >
        ×
      </button>

      {/* Bottom name strip */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pt-3 pb-1.5">
        <p className="truncate text-[10px] font-medium text-white drop-shadow">
          {clip.blockName}
        </p>
      </div>
    </div>
  );
}

function ZoomControls({ pxPerSec, onZoom }: { pxPerSec: number; onZoom: (n: number) => void }) {
  function adjust(dir: -1 | 1) {
    const closest = [...ZOOM_LEVELS].sort(
      (a, b) => Math.abs(a - pxPerSec) - Math.abs(b - pxPerSec),
    )[0]!;
    const idx = ZOOM_LEVELS.indexOf(closest);
    const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + dir));
    onZoom(ZOOM_LEVELS[next]!);
  }
  return (
    <div className="flex items-center gap-1 text-zinc-300">
      <button
        type="button"
        onClick={() => adjust(-1)}
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-xs leading-none hover:border-zinc-500"
        title="Zoom out"
      >
        −
      </button>
      <span className="min-w-[40px] text-center font-mono text-[10px] text-zinc-500">
        {pxPerSec}px/s
      </span>
      <button
        type="button"
        onClick={() => adjust(1)}
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-xs leading-none hover:border-zinc-500"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}

function computeInsertX(
  layout: Array<{ widthPx: number }>,
  insertIdx: number | null,
): number | null {
  if (insertIdx == null) return null;
  let cursor = 0;
  for (let i = 0; i < insertIdx; i++) {
    cursor += (layout[i]?.widthPx ?? 0) + 2;
  }
  return cursor - 1;
}

function chooseTickEvery(pxPerSec: number): number {
  const targetPx = 100;
  const candidates = [0.5, 1, 2, 5, 10, 20, 30, 60];
  let pick = 1;
  let best = Infinity;
  for (const c of candidates) {
    const px = c * pxPerSec;
    const dist = Math.abs(px - targetPx);
    if (dist < best) {
      best = dist;
      pick = c;
    }
  }
  return pick;
}

function cssUrl(url: string): string {
  return url.replace(/"/g, '\\"');
}

function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const tenths = Math.floor((s * 10) % 10);
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}.${tenths}`;
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <path d="M2.5 1.2l6 3.8-6 3.8z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <rect x="2.5" y="1.5" width="2" height="7" />
      <rect x="5.5" y="1.5" width="2" height="7" />
    </svg>
  );
}
