"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Platform } from "@crealify/db";
import {
  generatePostCopyAction,
  getPublishesSnapshotAction,
  publishVideoAction,
  saveCopyAction,
  type CopyPerPlatform,
  type PublishesSnapshot,
} from "./publish-actions";

type Props = {
  videoId: string;
  videoStatus: string;
  finalAssetUrl: string | null;
  initialCopy: CopyPerPlatform;
  initialPublishes: PublishesSnapshot;
};

const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram Reels",
  tiktok: "TikTok",
};

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-50 text-amber-800",
  publishing: "bg-amber-100 text-amber-900",
  succeeded: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-700",
};

export function PublishPanel({
  videoId,
  videoStatus,
  finalAssetUrl,
  initialCopy,
  initialPublishes,
}: Props) {
  const [copy, setCopy] = useState<CopyPerPlatform>(initialCopy);
  const [snapshot, setSnapshot] = useState<PublishesSnapshot>(initialPublishes);
  const [selected, setSelected] = useState<Set<Platform>>(new Set(["facebook", "instagram", "tiktok"]));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isPolling =
    snapshot.videoStatus === "publishing" ||
    snapshot.rows.some((r) => r.status === "queued" || r.status === "publishing");

  const tick = useCallback(async () => {
    const next = await getPublishesSnapshotAction(videoId);
    if (next) setSnapshot(next);
  }, [videoId]);

  useEffect(() => {
    if (!isPolling) return;
    const id = setInterval(tick, 4_000);
    return () => clearInterval(id);
  }, [isPolling, tick]);

  function onGenerate() {
    setMessage(null);
    const form = new FormData();
    form.set("language", "English");
    startTransition(async () => {
      const res = await generatePostCopyAction(videoId, form);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setCopy(res.copy);
      setMessage({ ok: true, text: "Captions generated." });
    });
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveCopyAction(videoId, form);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: "Saved." });
    });
  }

  function togglePlatform(p: Platform) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function onPublish() {
    if (selected.size === 0) {
      setMessage({ ok: false, text: "Pick at least one platform." });
      return;
    }
    startTransition(async () => {
      const res = await publishVideoAction(videoId, [...selected]);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: "Publish queued." });
      await tick();
    });
  }

  const ready = videoStatus === "ready_to_publish" || videoStatus === "published";

  return (
    <div className="space-y-4 rounded-lg border border-ink/10 bg-white p-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Publish</h2>
          <p className="text-[11px] text-ink/50">
            {ready
              ? "Review the per-platform copy below, then publish."
              : "Render the video before publishing."}
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={pending || !ready}
          className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate copy with Claude"}
        </button>
      </header>

      <form onSubmit={onSave} className="space-y-4">
        <label className="block text-xs">
          <span className="text-ink/70">Title (internal)</span>
          <input
            name="title"
            defaultValue={copy.title ?? ""}
            placeholder="e.g. Hook A · Lara · TikTok"
            className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
          />
        </label>

        <CaptionEditor
          platform="facebook"
          label="Facebook"
          maxCaption={8000}
          maxHashtags={30}
          value={copy.facebook}
          onChange={(v) => setCopy((c) => ({ ...c, facebook: v }))}
        />
        <CaptionEditor
          platform="instagram"
          label="Instagram Reels"
          maxCaption={2200}
          maxHashtags={30}
          value={copy.instagram}
          onChange={(v) => setCopy((c) => ({ ...c, instagram: v }))}
        />
        <CaptionEditor
          platform="tiktok"
          label="TikTok"
          maxCaption={2200}
          maxHashtags={20}
          value={copy.tiktok}
          onChange={(v) => setCopy((c) => ({ ...c, tiktok: v }))}
        />

        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
        >
          {pending ? "Saving…" : "Save copy"}
        </button>
      </form>

      <div className="space-y-3 border-t border-ink/10 pt-4">
        <p className="text-xs font-medium">Publish to</p>
        <div className="flex gap-2">
          {(["facebook", "instagram", "tiktok"] as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              disabled={!copy[p]?.caption}
              className={`rounded-full border px-3 py-1 text-xs ${
                selected.has(p)
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/15 bg-paper text-ink/70"
              } disabled:opacity-30`}
              title={!copy[p]?.caption ? "No caption written yet" : undefined}
            >
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onPublish}
          disabled={pending || !ready || !finalAssetUrl || selected.size === 0}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {pending ? "Queuing…" : `Publish to ${selected.size} platform${selected.size === 1 ? "" : "s"}`}
        </button>
        {message ? (
          <p className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
            {message.text}
          </p>
        ) : null}
      </div>

      {snapshot.rows.length > 0 ? (
        <div className="space-y-2 border-t border-ink/10 pt-4">
          <p className="text-xs font-medium">Publish history</p>
          <ul className="space-y-2">
            {snapshot.rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-ink/10 p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{PLATFORM_LABELS[r.platform]}</p>
                  {r.error ? (
                    <p className="line-clamp-2 text-[11px] text-red-700">{r.error}</p>
                  ) : r.externalPostUrl ? (
                    <a
                      href={r.externalPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[11px] text-ink/60 underline"
                    >
                      {r.externalPostUrl}
                    </a>
                  ) : r.externalPostId ? (
                    <p className="font-mono text-[11px] text-ink/50">{r.externalPostId}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    STATUS_STYLES[r.status] ?? "bg-ink/5 text-ink/60"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CaptionEditor({
  platform,
  label,
  maxCaption,
  maxHashtags,
  value,
  onChange,
}: {
  platform: Platform;
  label: string;
  maxCaption: number;
  maxHashtags: number;
  value: { caption: string; hashtags: string[] } | undefined;
  onChange: (v: { caption: string; hashtags: string[] }) => void;
}) {
  const caption = value?.caption ?? "";
  const hashtagsStr = (value?.hashtags ?? []).join(" ");

  return (
    <div className="rounded-md border border-ink/10 p-3">
      <p className="mb-2 text-xs font-medium">{label}</p>
      <label className="block text-[11px]">
        <span className="text-ink/60">
          Caption ({caption.length}/{maxCaption})
        </span>
        <textarea
          name={`${platform}_caption`}
          rows={3}
          value={caption}
          maxLength={maxCaption}
          onChange={(e) => onChange({ caption: e.target.value, hashtags: value?.hashtags ?? [] })}
          className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-2.5 py-1.5 text-xs text-ink outline-none focus:border-ink/40"
        />
      </label>
      <label className="mt-2 block text-[11px]">
        <span className="text-ink/60">Hashtags (space-separated, up to {maxHashtags})</span>
        <input
          name={`${platform}_hashtags`}
          value={hashtagsStr}
          onChange={(e) =>
            onChange({
              caption,
              hashtags: e.target.value
                .split(/\s+/)
                .map((t) => t.replace(/^#/, "").trim())
                .filter(Boolean),
            })
          }
          placeholder="tag1 tag2 tag3"
          className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-2.5 py-1.5 text-xs text-ink outline-none focus:border-ink/40"
        />
      </label>
    </div>
  );
}
