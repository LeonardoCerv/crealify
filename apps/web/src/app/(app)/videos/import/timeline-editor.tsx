"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TimelineSection = {
  slotType: string;
  label: string;
  startSec: number;
  endSec: number;
  text: string;
  rationale: string;
  selected: boolean;
};

const SLOT_TYPES = ["opener", "problem", "solution", "demo", "cta", "custom"] as const;

const SLOT_ACCENT: Record<string, string> = {
  opener: "bg-amber-400",
  problem: "bg-rose-400",
  solution: "bg-accent-400",
  demo: "bg-emerald-400",
  cta: "bg-orange-400",
  custom: "bg-zinc-400",
};
const accent = (slotType: string) => SLOT_ACCENT[slotType] ?? SLOT_ACCENT.custom!;

const MIN_SECTION_SEC = 0.5;
const RULER_HEIGHT = 26;
const TRACK_HEIGHT = 72;
const TRACK_LABEL_WIDTH = 44;
const TRACK_PADDING_Y = 8;
const HANDLE_WIDTH_PX = 8;
const ZOOM_LEVELS = [8, 14, 22, 36, 60, 100];

type Props = {
  videoUrl: string;
  durationSec: number;
  sections: TimelineSection[];
  onSectionsChange: (sections: TimelineSection[]) => void;
};

export function TimelineEditor({ videoUrl, durationSec, sections, onSectionsChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [dragging, setDragging] = useState<{ boundary: number } | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(() =>
    durationSec <= 30
      ? 36
      : durationSec <= 60
        ? 22
        : durationSec <= 120
          ? 14
          : 8,
  );

  useEffect(() => {
    if (selectedIdx >= sections.length) setSelectedIdx(Math.max(0, sections.length - 1));
  }, [sections.length, selectedIdx]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    function onTime() {
      if (v) setPlayheadSec(v.currentTime);
    }
    function onPlay() {
      setIsPlaying(true);
    }
    function onPause() {
      setIsPlaying(false);
    }
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  function seek(sec: number, play = false) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(sec, durationSec));
    if (play) void v.play();
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function selectSection(idx: number) {
    setSelectedIdx(idx);
    const s = sections[idx];
    if (s) seek(s.startSec);
  }

  function playSection(idx: number) {
    const s = sections[idx];
    if (!s) return;
    setSelectedIdx(idx);
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = s.startSec;
    void v.play();
    const onTime = () => {
      if (v.currentTime >= s.endSec - 0.05) {
        v.pause();
        v.removeEventListener("timeupdate", onTime);
      }
    };
    v.addEventListener("timeupdate", onTime);
  }

  function pxToSec(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(durationSec, x / pxPerSec));
  }

  function onRulerMouseDown(e: React.MouseEvent) {
    seek(pxToSec(e.clientX));
  }

  const updateBoundary = useCallback(
    (boundaryIdx: number, clientX: number) => {
      const sec = pxToSec(clientX);
      onSectionsChange(
        sections.map((s, i) => {
          if (i === boundaryIdx) {
            const next = sections[i + 1];
            const maxEnd = (next?.endSec ?? durationSec) - MIN_SECTION_SEC;
            const minEnd = s.startSec + MIN_SECTION_SEC;
            const v = Math.max(minEnd, Math.min(maxEnd, sec));
            return { ...s, endSec: round2(v) };
          }
          if (i === boundaryIdx + 1) {
            const prev = sections[boundaryIdx];
            const maxStart = s.endSec - MIN_SECTION_SEC;
            const minStart = (prev?.startSec ?? 0) + MIN_SECTION_SEC;
            const v = Math.max(minStart, Math.min(maxStart, sec));
            return { ...s, startSec: round2(v) };
          }
          return s;
        }),
      );
    },
    [sections, durationSec, onSectionsChange, pxPerSec],
  );

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      updateBoundary(dragging!.boundary, e.clientX);
    }
    function onUp() {
      setDragging(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateBoundary]);

  const selected = sections[selectedIdx];

  function updateSelected(patch: Partial<TimelineSection>) {
    onSectionsChange(sections.map((s, i) => (i === selectedIdx ? { ...s, ...patch } : s)));
  }

  function nudge(edge: "start" | "end", deltaSec: number) {
    if (!selected) return;
    if (edge === "start") {
      const newStart = round2(selected.startSec + deltaSec);
      const minStart =
        selectedIdx === 0 ? 0 : (sections[selectedIdx - 1]?.startSec ?? 0) + MIN_SECTION_SEC;
      const maxStart = selected.endSec - MIN_SECTION_SEC;
      const clamped = Math.max(minStart, Math.min(maxStart, newStart));
      onSectionsChange(
        sections.map((s, i) => {
          if (i === selectedIdx) return { ...s, startSec: clamped };
          if (i === selectedIdx - 1) return { ...s, endSec: clamped };
          return s;
        }),
      );
    } else {
      const newEnd = round2(selected.endSec + deltaSec);
      const minEnd = selected.startSec + MIN_SECTION_SEC;
      const maxEnd =
        selectedIdx === sections.length - 1
          ? durationSec
          : (sections[selectedIdx + 1]?.endSec ?? durationSec) - MIN_SECTION_SEC;
      const clamped = Math.max(minEnd, Math.min(maxEnd, newEnd));
      onSectionsChange(
        sections.map((s, i) => {
          if (i === selectedIdx) return { ...s, endSec: clamped };
          if (i === selectedIdx + 1) return { ...s, startSec: clamped };
          return s;
        }),
      );
    }
  }

  const tickEvery = useMemo(() => chooseTickEvery(pxPerSec), [pxPerSec]);
  const minorEvery = tickEvery / 5;
  const ticks: Array<{ sec: number; major: boolean }> = [];
  for (let t = 0; t <= durationSec + 0.001; t += minorEvery) {
    const sec = Math.round(t * 1000) / 1000;
    const major = Math.abs(sec / tickEvery - Math.round(sec / tickEvery)) < 0.001;
    ticks.push({ sec, major });
  }

  const contentWidth = Math.max(800, durationSec * pxPerSec + 24);
  const playheadX = playheadSec * pxPerSec;

  function adjustZoom(dir: -1 | 1) {
    const closest = [...ZOOM_LEVELS].sort(
      (a, b) => Math.abs(a - pxPerSec) - Math.abs(b - pxPerSec),
    )[0]!;
    const idx = ZOOM_LEVELS.indexOf(closest);
    const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + dir));
    setPxPerSec(ZOOM_LEVELS[next]!);
  }

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        <div className="relative grid place-items-center p-4">
          <video
            ref={videoRef}
            src={videoUrl}
            preload="metadata"
            playsInline
            className="max-h-[420px] rounded-md bg-black shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/5"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-white hover:bg-accent-400"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <p className="font-mono text-[11px] tabular-nums">
              <span className="text-zinc-100">{formatTime(playheadSec)}</span>
              <span className="text-zinc-500"> / {formatTime(durationSec)}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 text-zinc-300">
            <button
              type="button"
              onClick={() => adjustZoom(-1)}
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
              onClick={() => adjustZoom(1)}
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-xs leading-none hover:border-zinc-500"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex">
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
            <div ref={trackRef} style={{ width: contentWidth }} className="relative select-none">
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

                {sections.map((s, idx) => {
                  const left = s.startSec * pxPerSec;
                  const width = (s.endSec - s.startSec) * pxPerSec;
                  const a = accent(s.slotType);
                  const isSelected = idx === selectedIdx;
                  return (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectSection(idx)}
                      onDoubleClick={() => playSection(idx)}
                      title={`Double-click to preview · ${formatTime(s.startSec)} → ${formatTime(s.endSec)}`}
                      className={`absolute overflow-hidden rounded-md border transition ${
                        isSelected
                          ? "border-accent-400 shadow-[0_0_0_2px_rgba(74,140,255,0.45)]"
                          : "border-zinc-700 hover:border-zinc-500"
                      } ${!s.selected ? "opacity-40" : ""}`}
                      style={{
                        left,
                        width,
                        top: TRACK_PADDING_Y,
                        height: TRACK_HEIGHT,
                        backgroundColor: "#1a1a1f",
                        cursor: "pointer",
                      }}
                    >
                      <div className={`absolute inset-x-0 top-0 h-[3px] ${a}`} />

                      <span
                        className={`pointer-events-none absolute left-1.5 top-1.5 z-10 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${a} text-black`}
                      >
                        {s.slotType}
                      </span>

                      <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white">
                        {formatDuration(s.endSec - s.startSec)}
                      </span>

                      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pt-3 pb-1.5">
                        <p className="truncate text-[10px] font-medium text-white drop-shadow">
                          {s.label}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {sections.slice(0, -1).map((s, idx) => {
                  const x = s.endSec * pxPerSec;
                  return (
                    <div
                      key={`handle-${idx}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        setDragging({ boundary: idx });
                      }}
                      title="Drag to move boundary"
                      className="absolute top-0 z-30 cursor-col-resize"
                      style={{
                        left: x - HANDLE_WIDTH_PX / 2,
                        width: HANDLE_WIDTH_PX,
                        height: TRACK_HEIGHT + TRACK_PADDING_Y * 2,
                      }}
                    >
                      <div className="mx-auto h-full w-[2px] rounded bg-zinc-400 hover:bg-accent-400" />
                    </div>
                  );
                })}

                <div
                  className="pointer-events-none absolute z-20"
                  style={{
                    left: playheadX - 6,
                    top: -RULER_HEIGHT,
                    height: TRACK_HEIGHT + TRACK_PADDING_Y * 2 + RULER_HEIGHT,
                  }}
                >
                  <div className="mx-auto h-3 w-3 rotate-45 bg-accent-400 shadow-[0_0_8px_rgba(74,140,255,0.8)]" />
                  <div className="mx-auto h-full w-px bg-accent-400/90" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected section editor */}
      {selected ? (
        <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${accent(selected.slotType)}`} />
                Editing — <span className="uppercase tracking-wider text-ink/60">{selected.slotType}</span>
              </p>
              <p className="font-mono text-[11px] text-ink/55">
                {formatTime(selected.startSec)} → {formatTime(selected.endSec)} ·{" "}
                {formatDuration(selected.endSec - selected.startSec)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playSection(selectedIdx)}
                className="rounded-full border border-ink/15 bg-white px-3 py-1 text-[11px] text-ink/70 hover:text-ink"
              >
                ▶ Preview cut
              </button>
              <button
                type="button"
                onClick={() => updateSelected({ selected: !selected.selected })}
                className={`rounded-full border px-3 py-1 text-[11px] ${
                  selected.selected
                    ? "border-ink/15 bg-white text-ink/70 hover:text-ink"
                    : "border-accent-300 bg-accent-50 text-accent-700"
                }`}
              >
                {selected.selected ? "Skip this cut" : "Include this cut"}
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-ink/70">Label</span>
              <input
                value={selected.label}
                onChange={(e) => updateSelected({ label: e.target.value })}
                className="mt-1 block w-full rounded-md border border-ink/15 bg-paper-100 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent/50 focus:bg-white"
              />
            </label>
            <label className="block text-xs">
              <span className="text-ink/70">Slot type</span>
              <select
                value={
                  SLOT_TYPES.includes(selected.slotType as (typeof SLOT_TYPES)[number])
                    ? selected.slotType
                    : "custom"
                }
                onChange={(e) => updateSelected({ slotType: e.target.value })}
                className="mt-1 block w-full rounded-md border border-ink/15 bg-paper-100 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent/50 focus:bg-white"
              >
                {SLOT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-ink/55">Nudge start:</span>
            <NudgeButton onClick={() => nudge("start", -0.5)}>−0.5s</NudgeButton>
            <NudgeButton onClick={() => nudge("start", -0.1)}>−0.1s</NudgeButton>
            <NudgeButton onClick={() => nudge("start", 0.1)}>+0.1s</NudgeButton>
            <NudgeButton onClick={() => nudge("start", 0.5)}>+0.5s</NudgeButton>
            <span className="ml-3 text-ink/55">Nudge end:</span>
            <NudgeButton onClick={() => nudge("end", -0.5)}>−0.5s</NudgeButton>
            <NudgeButton onClick={() => nudge("end", -0.1)}>−0.1s</NudgeButton>
            <NudgeButton onClick={() => nudge("end", 0.1)}>+0.1s</NudgeButton>
            <NudgeButton onClick={() => nudge("end", 0.5)}>+0.5s</NudgeButton>
          </div>

          <label className="block text-xs">
            <span className="text-ink/70">Script (auto-extracted, editable)</span>
            <textarea
              rows={3}
              value={selected.text}
              onChange={(e) => updateSelected({ text: e.target.value })}
              className="mt-1 block w-full rounded-md border border-ink/15 bg-paper-100 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent/50 focus:bg-white"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function NudgeButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-ink/15 bg-white px-2 py-0.5 hover:bg-paper-100"
    >
      {children}
    </button>
  );
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

function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const tenths = Math.floor((s * 10) % 10);
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}.${tenths}`;
}

function formatDuration(sec: number): string {
  if (sec < 10) return `${sec.toFixed(1)}s`;
  return `${Math.round(sec)}s`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
