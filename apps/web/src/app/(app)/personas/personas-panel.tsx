"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  createPersonaAction,
  deletePersonaAction,
  listElevenLabsVoicesAction,
  mintPersonaImageUploadAction,
  updatePersonaAction,
  type VoiceOption,
} from "./actions";

type PersonaRow = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  soulId: string | null;
  voiceExternalId: string | null;
};

export function PersonasPanel({ personas }: { personas: PersonaRow[] }) {
  const [adding, setAdding] = useState(personas.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Lazy-load voices when the form first opens.
  useEffect(() => {
    if (!adding && editingId === null) return;
    if (voices.length > 0 || voicesError) return;
    setVoicesLoading(true);
    void listElevenLabsVoicesAction().then((res) => {
      if (res.ok) setVoices(res.voices);
      else setVoicesError(res.error);
      setVoicesLoading(false);
    });
  }, [adding, editingId, voices.length, voicesError]);

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createPersonaAction(form);
      setMessage({ ok: res.ok, text: res.ok ? "Persona created." : res.error });
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
        setAdding(false);
      }
    });
  }

  function onUpdate(id: string, formEl: HTMLFormElement) {
    const form = new FormData(formEl);
    startTransition(async () => {
      const res = await updatePersonaAction(id, form);
      setMessage({ ok: res.ok, text: res.ok ? "Saved." : res.error });
      if (res.ok) setEditingId(null);
    });
  }

  function onDelete(id: string, name: string) {
    if (!confirm(`Delete persona "${name}"?`)) return;
    startTransition(async () => {
      const res = await deletePersonaAction(id);
      setMessage({ ok: res.ok, text: res.ok ? "Deleted." : res.error });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {personas.length} persona{personas.length === 1 ? "" : "s"}
        </p>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
          >
            New persona
          </button>
        ) : null}
      </div>

      {adding ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-lg border border-ink/10 bg-white p-5"
        >
          <h3 className="text-sm font-medium">New persona</h3>
          <PersonaFormFields
            voices={voices}
            voicesError={voicesError}
            voicesLoading={voicesLoading}
          />
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
            >
              Cancel
            </button>
            {message ? <Inline message={message} /> : null}
          </div>
        </form>
      ) : null}

      {personas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
          No personas yet. Add one to swap the character + voice on any video.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {personas.map((p) => (
            <li key={p.id} className="rounded-lg border border-ink/10 bg-white">
              {editingId === p.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onUpdate(p.id, e.currentTarget);
                  }}
                  className="space-y-3 p-5"
                >
                  <PersonaFormFields
                    initial={p}
                    voices={voices}
                    voicesError={voicesError}
                    voicesLoading={voicesLoading}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex gap-4 p-5">
                  {p.referenceImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.referenceImageUrl}
                      alt={p.name}
                      className="h-20 w-20 rounded-md object-cover"
                    />
                  ) : (
                    <div className="grid h-20 w-20 place-items-center rounded-md bg-paper-200 text-xs text-ink/40">
                      no image
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.voiceExternalId ? (
                      <p className="font-mono text-[11px] text-ink/50">
                        voice: {voices.find((v) => v.voiceId === p.voiceExternalId)?.name ?? p.voiceExternalId.slice(0, 12) + "…"}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700">no voice yet</p>
                    )}
                    {p.description ? (
                      <p className="text-xs text-ink/60">{p.description}</p>
                    ) : null}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(p.id)}
                        className="text-xs text-ink/60 underline-offset-2 hover:text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(p.id, p.name)}
                        className="text-xs text-red-700 underline-offset-2 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonaFormFields({
  initial,
  voices,
  voicesError,
  voicesLoading,
}: {
  initial?: PersonaRow;
  voices: VoiceOption[];
  voicesError: string | null;
  voicesLoading: boolean;
}) {
  return (
    <>
      <Field name="name" label="Display name" defaultValue={initial?.name} required />
      <ImageUploadField
        name="referenceImageUrl"
        label="Persona image"
        defaultValue={initial?.referenceImageUrl ?? ""}
      />
      <label className="block text-xs">
        <span className="text-ink/70">Voice (Spanish only)</span>
        {voicesLoading ? (
          <p className="mt-1 text-[11px] text-ink/50">Loading your voices…</p>
        ) : voicesError ? (
          <>
            <p className="mt-1 text-[11px] text-amber-700">{voicesError}</p>
            <input
              name="voiceExternalId"
              defaultValue={initial?.voiceExternalId ?? ""}
              placeholder="Paste voice ID manually"
              className="mt-1 block w-full rounded-md border border-ink/15 bg-paper-100 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50 focus:bg-white"
            />
          </>
        ) : voices.length === 0 ? (
          <>
            <p className="mt-1 text-[11px] text-amber-700">
              No Spanish voices found in your ElevenLabs library — paste an ID manually below.
            </p>
            <input
              name="voiceExternalId"
              defaultValue={initial?.voiceExternalId ?? ""}
              placeholder="Voice ID"
              className="mt-1 block w-full rounded-md border border-ink/15 bg-paper-100 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50 focus:bg-white"
            />
          </>
        ) : (
          <select
            name="voiceExternalId"
            defaultValue={initial?.voiceExternalId ?? ""}
            className="mt-1 block w-full rounded-md border border-ink/15 bg-paper-100 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50 focus:bg-white"
          >
            <option value="">— no voice —</option>
            {voices.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </label>
      <Field
        name="description"
        label="Notes (optional)"
        defaultValue={initial?.description ?? ""}
        placeholder="Persona vibe, tone, role"
      />
    </>
  );
}

function ImageUploadField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  async function onFile(file: File) {
    setError(null);
    setProgress(0);
    const mint = await mintPersonaImageUploadAction({
      contentType: file.type || "image/jpeg",
      byteSize: file.size,
    });
    if (!mint.ok) {
      setError(mint.error);
      setProgress(null);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", mint.uploadUrl);
      xhr.setRequestHeader("content-type", file.type || "image/jpeg");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(file);
    }).then(
      () => {
        setUrl(mint.publicUrl);
        setProgress(100);
      },
      (err: Error) => {
        setError(err.message);
        setProgress(null);
      },
    );
  }

  return (
    <div>
      <p className="text-xs text-ink/70">{label}</p>
      <div className="mt-1 flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-ink/15 bg-paper-100">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-ink/40">no image</span>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <label className="inline-block cursor-pointer rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/70 hover:bg-paper-100">
            {url ? "Replace image…" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
          {progress !== null && progress < 100 ? (
            <p className="text-[11px] text-ink/55">Uploading: {progress}%</p>
          ) : progress === 100 ? (
            <p className="text-[11px] text-emerald-700">Uploaded ✓</p>
          ) : null}
          {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
        </div>
      </div>
      <input type="hidden" name={name} value={url} />
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="text-ink/70">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper-100 px-3 py-2 text-sm text-ink outline-none focus:border-accent/50 focus:bg-white"
      />
    </label>
  );
}

function Inline({ message }: { message: { ok: boolean; text: string } }) {
  return (
    <span className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
      {message.text}
    </span>
  );
}
