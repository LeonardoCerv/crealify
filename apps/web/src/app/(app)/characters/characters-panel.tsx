"use client";

import { useState, useTransition } from "react";
import type { Character } from "@crealify/db";
import {
  createCharacterAction,
  deleteCharacterAction,
  updateCharacterAction,
} from "./actions";

export function CharactersPanel({ characters }: { characters: Character[] }) {
  const [adding, setAdding] = useState(characters.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createCharacterAction(form);
      setMessage({ ok: res.ok, text: res.ok ? "Character added." : res.error });
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
        setAdding(false);
      }
    });
  }

  function onUpdate(id: string, formEl: HTMLFormElement) {
    const form = new FormData(formEl);
    startTransition(async () => {
      const res = await updateCharacterAction(id, form);
      setMessage({ ok: res.ok, text: res.ok ? "Updated." : res.error });
      if (res.ok) setEditingId(null);
    });
  }

  function onDelete(id: string, name: string) {
    if (!confirm(`Remove character "${name}"? Videos using it will keep their cached renders.`)) return;
    startTransition(async () => {
      const res = await deleteCharacterAction(id);
      setMessage({ ok: res.ok, text: res.ok ? "Removed." : res.error });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {characters.length} character{characters.length === 1 ? "" : "s"} connected
        </p>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper"
          >
            Connect a Soul ID
          </button>
        ) : null}
      </div>

      {adding ? (
        <form
          onSubmit={onCreate}
          className="space-y-3 rounded-lg border border-ink/10 bg-white p-5"
        >
          <h3 className="text-sm font-medium">New character</h3>
          <Field name="name" label="Display name" placeholder="e.g. Lara — confident founder" required />
          <Field
            name="soulId"
            label="Higgsfield Soul ID"
            placeholder="soul_xxxxxxx"
            required
          />
          <Field
            name="referenceImageUrl"
            label="Reference image URL (optional)"
            placeholder="https://..."
          />
          <Field
            name="description"
            label="Notes (optional)"
            placeholder="Persona, vibe, age range, vocal tone…"
          />
          <Field
            name="defaultPreset"
            label="Default Soul preset (optional)"
            placeholder="e.g. Warm Ambient"
          />
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

      {characters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
          No characters yet. Train a Soul ID in Higgsfield, then click <em>Connect a Soul ID</em>.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {characters.map((c) => (
            <li key={c.id} className="rounded-lg border border-ink/10 bg-white">
              {editingId === c.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onUpdate(c.id, e.currentTarget);
                  }}
                  className="space-y-3 p-5"
                >
                  <Field name="name" label="Display name" defaultValue={c.name} required />
                  <Field name="soulId" label="Soul ID" defaultValue={c.soulId} required />
                  <Field
                    name="referenceImageUrl"
                    label="Reference image URL"
                    defaultValue={c.referenceImageUrl ?? ""}
                  />
                  <Field
                    name="description"
                    label="Notes"
                    defaultValue={c.description ?? ""}
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
                <div className="flex gap-4 p-5">
                  {c.referenceImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.referenceImageUrl}
                      alt={c.name}
                      className="h-20 w-20 rounded-md object-cover"
                    />
                  ) : (
                    <div className="grid h-20 w-20 place-items-center rounded-md bg-ink/5 text-xs text-ink/40">
                      no image
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="font-mono text-[11px] text-ink/50">{c.soulId}</p>
                    {c.description ? (
                      <p className="text-xs text-ink/60">{c.description}</p>
                    ) : null}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(c.id)}
                        className="text-xs text-ink/60 underline-offset-2 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c.id, c.name)}
                        className="text-xs text-red-700 underline-offset-2 hover:underline"
                      >
                        Remove
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

function Inline({ message }: { message: { ok: boolean; text: string } }) {
  return (
    <span className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
      {message.text}
    </span>
  );
}
