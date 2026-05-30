"use client";

import { useState, useTransition } from "react";
import type { IntegrationProvider } from "@crealify/db";
import { deleteTokenAction, saveTokenAction, verifyTokenAction } from "./actions";

type ExtraField = { name: string; label: string; placeholder?: string };

type Props = {
  provider: IntegrationProvider;
  label: string;
  help: string;
  secretLabel: string;
  extraFields: ExtraField[];
  configured: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
};

export function ProviderCard({
  provider,
  label,
  help,
  secretLabel,
  extraFields,
  configured,
  lastVerifiedAt,
  lastError,
  metadata,
}: Props) {
  const [editing, setEditing] = useState(!configured);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("provider", provider);
    startTransition(async () => {
      const res = await saveTokenAction(form);
      setMessage({ ok: res.ok, text: res.ok ? "Saved & verified." : res.error });
      if (res.ok) setEditing(false);
    });
  }

  function onVerify() {
    startTransition(async () => {
      const res = await verifyTokenAction(provider);
      setMessage({ ok: res.ok, text: res.ok ? "Verified." : res.error });
    });
  }

  function onDelete() {
    if (!confirm(`Remove ${label} token?`)) return;
    startTransition(async () => {
      await deleteTokenAction(provider);
      setMessage({ ok: true, text: "Removed." });
      setEditing(true);
    });
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white">
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-ink/60">{help}</p>
        </div>
        <StatusBadge configured={configured} verifiedAt={lastVerifiedAt} error={lastError} />
      </div>

      {editing ? (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-ink/10 p-5">
          <Field
            name="secret"
            label={secretLabel}
            type="password"
            placeholder="paste token"
            required
          />
          {extraFields.map((f) => (
            <Field
              key={f.name}
              name={f.name}
              label={f.label}
              defaultValue={(metadata[f.name] as string | undefined) ?? ""}
              placeholder={f.placeholder}
            />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save & verify"}
            </button>
            {configured ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
              >
                Cancel
              </button>
            ) : null}
          </div>
          {message ? <Inline message={message} /> : null}
        </form>
      ) : (
        <div className="flex items-center gap-2 border-t border-ink/10 p-5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onVerify}
            disabled={pending}
            className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-50"
          >
            {pending ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="rounded-full border border-red-200 px-4 py-1.5 text-xs text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
          {message ? <Inline message={message} /> : null}
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs">
      <span className="text-ink/70">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
      />
    </label>
  );
}

function StatusBadge({
  configured,
  verifiedAt,
  error,
}: {
  configured: boolean;
  verifiedAt: string | null;
  error: string | null;
}) {
  if (!configured) {
    return (
      <span className="rounded-full border border-ink/15 px-3 py-1 text-[11px] text-ink/50">
        Not connected
      </span>
    );
  }
  if (error) {
    return (
      <span
        title={error ?? undefined}
        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700"
      >
        Error
      </span>
    );
  }
  if (verifiedAt) {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
        Verified
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">
      Unverified
    </span>
  );
}

function Inline({ message }: { message: { ok: boolean; text: string } }) {
  return (
    <span
      className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}
    >
      {message.text}
    </span>
  );
}
