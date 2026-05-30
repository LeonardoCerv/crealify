"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AspectRatio } from "@crealify/db";
import {
  cloneVideoAction,
  createVideoAction,
  deleteVideoAction,
  updateVideoAction,
} from "./actions";
import { ComposerLibrary } from "./composer-library";
import { ComposerPreview, type PreviewClip } from "./composer-preview";
import { ComposerTimeline, type TimelineClip } from "./composer-timeline";

export type BlockSummary = {
  id: string;
  name: string;
  slotType: string;
  source: string;
  script: string | null;
  posterUrl?: string | null;
  uploadedAssetUrl?: string | null;
  estimatedDurationMs?: number | null;
  hasBurnedCaptions?: boolean;
};

export type PersonaSummary = {
  id: string;
  name: string;
  referenceImageUrl: string | null;
  voiceExternalId: string | null;
};

// Back-compat type aliases so callers don't break while we transition.
export type CharacterSummary = { id: string; name: string };
export type VoiceSummary = { id: string; name: string; defaultCharacterId: string | null };

export type Binding = { slotId: string; blockId: string; backgroundVariantId?: string };

type Initial = {
  id: string | null;
  name: string;
  templateId: string;
  characterId: string | null;
  voiceId: string | null;
  aspect: AspectRatio;
  bindings: Binding[];
};

const ASPECTS: AspectRatio[] = ["9:16", "1:1", "16:9"];
const FALLBACK_CLIP_SEC = 5;

export function VideoComposer({
  mode,
  initial,
  freeformSlotIds,
  blocks,
  personas,
}: {
  mode: "create" | "edit";
  initial: Initial;
  freeformSlotIds: string[];
  blocks: BlockSummary[];
  personas: PersonaSummary[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name || "Untitled video");
  const [personaId, setPersonaId] = useState<string>(initial.characterId ?? "");
  const [aspect, setAspect] = useState<AspectRatio>(initial.aspect);
  const [bindings, setBindings] = useState<Binding[]>(initial.bindings);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(22);
  const [showPersona, setShowPersona] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  const orderedClips = useMemo(
    () =>
      bindings
        .map((b) => {
          const block = blocksById.get(b.blockId);
          if (!block) return null;
          return { binding: b, block };
        })
        .filter((x): x is { binding: Binding; block: BlockSummary } => x !== null),
    [bindings, blocksById],
  );

  const timelineClips: TimelineClip[] = useMemo(
    () =>
      orderedClips.map((it) => ({
        id: it.binding.slotId,
        blockId: it.block.id,
        blockName: it.block.name,
        slotType: it.block.slotType,
        posterUrl: it.block.posterUrl ?? null,
        durationSec: (it.block.estimatedDurationMs ?? FALLBACK_CLIP_SEC * 1000) / 1000,
      })),
    [orderedClips],
  );

  const previewClips: PreviewClip[] = useMemo(
    () =>
      orderedClips.map((it) => ({
        id: it.binding.slotId,
        url: it.block.uploadedAssetUrl ?? null,
        posterUrl: it.block.posterUrl ?? null,
        durationSec: (it.block.estimatedDurationMs ?? FALLBACK_CLIP_SEC * 1000) / 1000,
      })),
    [orderedClips],
  );

  const totalSec = timelineClips.reduce((sum, c) => sum + c.durationSec, 0);

  useEffect(() => {
    if (selectedIdx != null && selectedIdx >= timelineClips.length) {
      setSelectedIdx(timelineClips.length > 0 ? timelineClips.length - 1 : null);
    }
    if (playheadSec > totalSec) setPlayheadSec(totalSec);
  }, [timelineClips.length, selectedIdx, playheadSec, totalSec]);

  // Spacebar play/pause (when not typing in an input)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (timelineClips.length === 0) return;
      e.preventDefault();
      setIsPlaying((p) => !p);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timelineClips.length]);

  function nextFreeSlotId(): string | null {
    const used = new Set(bindings.map((b) => b.slotId));
    return freeformSlotIds.find((id) => !used.has(id)) ?? null;
  }

  function addFromLibrary(blockId: string, atIdx: number) {
    const slotId = nextFreeSlotId();
    if (!slotId) {
      setMessage({ ok: false, text: "Timeline is full (32 clips max)." });
      return;
    }
    setBindings((arr) => {
      const next = [...arr];
      next.splice(atIdx, 0, { slotId, blockId });
      return next;
    });
    setSelectedIdx(atIdx);
  }

  function reorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    setBindings((arr) => {
      const next = [...arr];
      const [moved] = next.splice(fromIdx, 1);
      if (!moved) return arr;
      const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx;
      next.splice(adjusted, 0, moved);
      return next;
    });
    setSelectedIdx(toIdx > fromIdx ? toIdx - 1 : toIdx);
  }

  function removeAt(idx: number) {
    setBindings((arr) => arr.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  }

  function save() {
    const form = new FormData();
    form.set("name", name);
    form.set("templateId", initial.templateId);
    // A Persona owns image + voice. We stash its id in the existing
    // characterId column on the video; voice gets resolved server-side.
    form.set("characterId", personaId);
    form.set("voiceId", "");
    form.set("aspect", aspect);
    form.set("bindings", JSON.stringify(bindings));
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createVideoAction(form)
          : await updateVideoAction(initial.id!, form);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: mode === "create" ? "Draft saved." : "Saved." });
      if (mode === "create" && res.id) router.push(`/videos/${res.id}`);
      else router.refresh();
    });
  }

  function onClone() {
    if (!initial.id) return;
    startTransition(async () => {
      const res = await cloneVideoAction(initial.id!);
      if (res.ok && res.id) router.push(`/videos/${res.id}`);
      else if (!res.ok) setMessage({ ok: false, text: res.error });
    });
  }

  function onDelete() {
    if (!initial.id) return;
    if (!confirm("Delete this draft?")) return;
    startTransition(async () => {
      const res = await deleteVideoAction(initial.id!);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      router.push("/videos");
      router.refresh();
    });
  }

  return (
    <div className="flex h-[calc(100vh-110px)] min-h-[640px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)]">
      {/* Chrome bar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Crealify
          </span>
          <span className="text-zinc-700">/</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Untitled video"
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none hover:border-zinc-700 focus:border-accent-500/60 focus:bg-zinc-950"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-zinc-700 bg-zinc-950 p-0.5 text-[11px]">
            {ASPECTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAspect(a)}
                className={`rounded px-2 py-0.5 font-mono ${
                  aspect === a
                    ? "bg-accent-500 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowPersona((p) => !p)}
            className={`rounded-md border px-2.5 py-1 text-[11px] ${
              showPersona
                ? "border-accent-500/70 bg-accent-500/15 text-accent-300"
                : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Persona
          </button>
          {mode === "edit" ? (
            <>
              <button
                type="button"
                onClick={onClone}
                disabled={pending}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-zinc-100"
              >
                Clone
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="rounded-md border border-red-900/60 bg-red-950/40 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-950/70"
              >
                Delete
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={pending || bindings.length === 0}
            className="rounded-md bg-accent-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-accent-400 disabled:opacity-40"
          >
            {pending ? "Saving…" : mode === "create" ? "Save draft" : "Save"}
          </button>
        </div>
      </div>

      {/* Persona drawer */}
      {showPersona ? (
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-3">
          <label className="flex-1 text-[10px] uppercase tracking-wider text-zinc-500">
            Persona (swaps voice across every clip · keeps original visuals)
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="mt-0.5 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-accent-500/60"
            >
              <option value="">— keep original —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.voiceExternalId ? "" : "  · no voice yet"}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/personas"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-[11px] text-zinc-300 hover:text-zinc-100"
          >
            Manage personas →
          </Link>
        </div>
      ) : null}

      {/* Editor body: library | preview */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-[240px] shrink-0">
          <ComposerLibrary
            blocks={blocks.map((b) => ({
              id: b.id,
              name: b.name,
              slotType: b.slotType,
              script: b.script,
              posterUrl: b.posterUrl,
              estimatedDurationMs: b.estimatedDurationMs,
              hasBurnedCaptions: b.hasBurnedCaptions,
            }))}
          />
        </div>
        <ComposerPreview
          clips={previewClips}
          aspect={aspect}
          playheadSec={playheadSec}
          isPlaying={isPlaying}
          onPlayheadChange={setPlayheadSec}
          onPlayingChange={setIsPlaying}
        />
      </div>

      {/* Timeline */}
      <div className="h-[200px] shrink-0">
        <ComposerTimeline
          clips={timelineClips}
          selectedIndex={selectedIdx}
          playheadSec={playheadSec}
          pxPerSec={pxPerSec}
          isPlaying={isPlaying}
          totalSec={totalSec}
          onSelect={setSelectedIdx}
          onRemove={removeAt}
          onPlayheadChange={(sec) => {
            setPlayheadSec(sec);
            if (isPlaying) setIsPlaying(false);
          }}
          onAddFromLibrary={addFromLibrary}
          onReorder={reorder}
          onZoom={setPxPerSec}
          onTogglePlay={() => setIsPlaying((p) => !p)}
        />
      </div>

      {/* Status bar */}
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-3 font-mono text-[10px] tabular-nums text-zinc-500">
        <span>
          {bindings.length} clip{bindings.length === 1 ? "" : "s"} · {totalSec.toFixed(1)}s
        </span>
        <span>
          {message ? (
            <span className={message.ok ? "text-emerald-400" : "text-red-400"}>
              {message.text}
            </span>
          ) : (
            "spacebar to play · drag to add · drag clips to reorder"
          )}
        </span>
        <span>zoom {pxPerSec}px/s</span>
      </div>
    </div>
  );
}
