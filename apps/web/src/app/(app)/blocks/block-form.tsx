"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlockSource } from "@crealify/db";
import { createBlockAction, deleteBlockAction, updateBlockAction } from "./actions";
import { UploadField } from "./upload-field";

const SOURCES: { value: BlockSource; label: string; help: string }[] = [
  {
    value: "higgsfield_lipsync",
    label: "Higgsfield — lipsync",
    help: "Talking character driven by a script + voice + portrait. Most common.",
  },
  {
    value: "higgsfield_dop",
    label: "Higgsfield — DoP",
    help: "Cinematic 5s image→video. Camera moves, no dialogue.",
  },
  {
    value: "higgsfield_motion_control",
    label: "Higgsfield — motion control",
    help: "Replaces actor in a reference video with the character.",
  },
  {
    value: "screen_recording",
    label: "Screen recording (Demo)",
    help: "Your uploaded screen capture of the product.",
  },
  {
    value: "upload",
    label: "Upload (generic)",
    help: "Pre-made video clip you supply via URL.",
  },
  {
    value: "broll_stock",
    label: "Stock B-roll",
    help: "Stock footage URL.",
  },
  {
    value: "ai_image_to_video",
    label: "AI image → video",
    help: "Generate a clip from a still image.",
  },
];

const SOURCE_FEATURES_CHARACTER: Record<BlockSource, boolean> = {
  higgsfield_lipsync: true,
  higgsfield_dop: false,
  higgsfield_motion_control: true,
  screen_recording: false,
  upload: false,
  broll_stock: false,
  ai_image_to_video: false,
};

const SOURCE_NEEDS_SCRIPT: Record<BlockSource, boolean> = {
  higgsfield_lipsync: true,
  higgsfield_dop: false,
  higgsfield_motion_control: true,
  screen_recording: false,
  upload: false,
  broll_stock: false,
  ai_image_to_video: false,
};

const SOURCE_NEEDS_UPLOAD: Record<BlockSource, boolean> = {
  higgsfield_lipsync: false,
  higgsfield_dop: false,
  higgsfield_motion_control: true,
  screen_recording: true,
  upload: true,
  broll_stock: true,
  ai_image_to_video: false,
};

type Initial = {
  id: string | null;
  name: string;
  slotType: string;
  source: BlockSource;
  script: string;
  featuresCharacter: boolean;
  estimatedDurationMs: number | null;
  uploadedAssetUrl: string;
  hasBurnedCaptions: boolean;
};

export function BlockForm({ mode, initial }: { mode: "create" | "edit"; initial: Initial }) {
  const router = useRouter();
  const [source, setSource] = useState<BlockSource>(initial.source);
  const [featuresCharacter, setFeaturesCharacter] = useState(initial.featuresCharacter);
  const [hasBurnedCaptions, setHasBurnedCaptions] = useState(initial.hasBurnedCaptions);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSourceChange(s: BlockSource) {
    setSource(s);
    setFeaturesCharacter(SOURCE_FEATURES_CHARACTER[s]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createBlockAction(form)
          : await updateBlockAction(initial.id!, form);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: mode === "create" ? "Created." : "Saved." });
      if (mode === "create" && res.id) router.push(`/blocks/${res.id}`);
      else router.refresh();
    });
  }

  function onDelete() {
    if (!initial.id) return;
    if (!confirm("Delete this block? Videos that reference it will show it as missing.")) return;
    startTransition(async () => {
      const res = await deleteBlockAction(initial.id!);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      router.push("/blocks");
      router.refresh();
    });
  }

  const needsScript = SOURCE_NEEDS_SCRIPT[source];
  const needsUpload = SOURCE_NEEDS_UPLOAD[source];

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
        <Field name="name" label="Block name" defaultValue={initial.name} required />
        <Field
          name="slotType"
          label="Slot type"
          defaultValue={initial.slotType}
          placeholder="opener · problem · solution · demo · cta · custom"
          required
        />
        <p className="text-[11px] text-ink/50">
          Slot type must match the slot it&apos;ll bind to in a template (e.g.
          <span className="font-mono"> opener</span>).
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
        <label className="block text-xs">
          <span className="text-ink/70">Source</span>
          <select
            name="source"
            value={source}
            onChange={(e) => onSourceChange(e.target.value as BlockSource)}
            className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-ink/60">{SOURCES.find((s) => s.value === source)?.help}</p>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="featuresCharacter"
            checked={featuresCharacter}
            onChange={(e) => setFeaturesCharacter(e.target.checked)}
          />
          Features the character — re-renders when the character changes.
        </label>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            name="hasBurnedCaptions"
            checked={hasBurnedCaptions}
            onChange={(e) => setHasBurnedCaptions(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Already has captions burned in — skip our caption pass during assembly so we don&apos;t
            stack text on top of text.
          </span>
        </label>
      </div>

      {needsScript ? (
        <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
          <label className="block text-xs">
            <span className="text-ink/70">Script</span>
            <textarea
              name="script"
              defaultValue={initial.script}
              rows={4}
              placeholder="What the character says…"
              className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
            />
          </label>
        </div>
      ) : (
        <input type="hidden" name="script" value="" />
      )}

      {needsUpload ? (
        <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
          <UploadField
            name="uploadedAssetUrl"
            defaultValue={initial.uploadedAssetUrl}
            label="Asset URL"
          />
          <p className="text-[11px] text-ink/50">
            Drop in a screen recording or paste an existing URL. Uploaded files go straight to your
            storage bucket via a presigned URL — no server round-trip.
          </p>
        </div>
      ) : (
        <input type="hidden" name="uploadedAssetUrl" value="" />
      )}

      <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
        <Field
          name="estimatedDurationMs"
          label="Estimated duration (ms)"
          type="number"
          defaultValue={initial.estimatedDurationMs?.toString() ?? ""}
          placeholder="e.g. 4000"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "create" ? "Create block" : "Save changes"}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-full border border-red-200 px-4 py-2 text-xs text-red-700"
          >
            Delete
          </button>
        ) : null}
        {message ? (
          <span
            className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-ink/70">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
      />
    </label>
  );
}
