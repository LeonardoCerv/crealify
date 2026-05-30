"use client";

import { useState, useTransition } from "react";
import { createVoiceAction, deleteVoiceAction, updateVoiceAction } from "./actions";

type VoiceRow = {
  id: string;
  name: string;
  provider: string;
  externalId: string;
  defaultCharacterId: string | null;
  settings:
    | {
        stability?: number;
        similarityBoost?: number;
        style?: number;
        speakerBoost?: boolean;
        modelId?: string;
      }
    | null;
  createdAt: string;
  updatedAt: string;
};

type CharacterRow = { id: string; name: string };

export function VoicesPanel({
  voices,
  characters,
}: {
  voices: VoiceRow[];
  characters: CharacterRow[];
}) {
  const [adding, setAdding] = useState(voices.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createVoiceAction(form);
      setMessage({ ok: res.ok, text: res.ok ? "Voice added." : res.error });
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
        setAdding(false);
      }
    });
  }

  function submitUpdate(id: string, formEl: HTMLFormElement) {
    const form = new FormData(formEl);
    startTransition(async () => {
      const res = await updateVoiceAction(id, form);
      setMessage({ ok: res.ok, text: res.ok ? "Updated." : res.error });
      if (res.ok) setEditingId(null);
    });
  }

  function onDelete(id: string, name: string) {
    if (!confirm(`Remove voice "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteVoiceAction(id);
      setMessage({ ok: res.ok, text: res.ok ? "Removed." : res.error });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {voices.length} voice{voices.length === 1 ? "" : "s"}
        </p>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper"
          >
            Add a voice
          </button>
        ) : null}
      </div>

      {adding ? (
        <form
          onSubmit={submitCreate}
          className="space-y-3 rounded-lg border border-ink/10 bg-white p-5"
        >
          <h3 className="text-sm font-medium">New voice</h3>
          <Field name="name" label="Display name" placeholder="e.g. Lara — warm storyteller" required />
          <Field name="externalId" label="ElevenLabs voice ID" placeholder="21m00..." required />
          <CharacterSelect characters={characters} name="defaultCharacterId" />
          <details className="text-xs text-ink/60">
            <summary className="cursor-pointer">Advanced voice settings</summary>
            <div className="mt-2 space-y-2">
              <Field name="modelId" label="Model ID" placeholder="eleven_multilingual_v2" />
              <NumberField name="stability" label="Stability (0–1)" />
              <NumberField name="similarityBoost" label="Similarity boost (0–1)" />
              <NumberField name="style" label="Style (0–1)" />
              <label className="flex items-center gap-2">
                <input name="speakerBoost" type="checkbox" />
                Speaker boost
              </label>
            </div>
          </details>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
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

      {voices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
          No voices yet. Grab a voice ID from your ElevenLabs library and paste it here.
        </div>
      ) : (
        <ul className="space-y-3">
          {voices.map((v) => (
            <li key={v.id} className="rounded-lg border border-ink/10 bg-white">
              {editingId === v.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitUpdate(v.id, e.currentTarget);
                  }}
                  className="space-y-3 p-5"
                >
                  <Field name="name" label="Display name" defaultValue={v.name} required />
                  <Field
                    name="externalId"
                    label="ElevenLabs voice ID"
                    defaultValue={v.externalId}
                    required
                  />
                  <CharacterSelect
                    characters={characters}
                    name="defaultCharacterId"
                    defaultValue={v.defaultCharacterId ?? undefined}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
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
                <div className="flex items-center justify-between gap-4 p-5">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="font-mono text-[11px] text-ink/50">
                      {v.provider} · {v.externalId}
                    </p>
                    {v.defaultCharacterId ? (
                      <p className="mt-1 text-xs text-ink/60">
                        Default for{" "}
                        {characters.find((c) => c.id === v.defaultCharacterId)?.name ?? "—"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(v.id)}
                      className="text-xs text-ink/60 underline-offset-2 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v.id, v.name)}
                      className="text-xs text-red-700 underline-offset-2 hover:underline"
                    >
                      Remove
                    </button>
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
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
      />
    </label>
  );
}

function NumberField({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-xs">
      <span className="text-ink/70">{label}</span>
      <input
        type="number"
        step="0.05"
        min="0"
        max="1"
        name={name}
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
      />
    </label>
  );
}

function CharacterSelect({
  characters,
  name,
  defaultValue,
}: {
  characters: CharacterRow[];
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-ink/70">Default character (optional)</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
      >
        <option value="">— none —</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
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
