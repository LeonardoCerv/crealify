"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTemplateAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "./actions";
import { SlotEditor, type Slot } from "./slot-editor";

type Initial = {
  id: string | null;
  name: string;
  description: string;
  slots: Slot[];
};

export function TemplateForm({ mode, initial }: { mode: "create" | "edit"; initial: Initial }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createTemplateAction(form)
          : await updateTemplateAction(initial.id!, form);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: mode === "create" ? "Created." : "Saved." });
      if (mode === "create" && res.id) {
        router.push(`/templates/${res.id}`);
      } else {
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!initial.id) return;
    if (!confirm("Delete this template? Videos already created from it are unaffected.")) return;
    startTransition(async () => {
      const res = await deleteTemplateAction(initial.id!);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      router.push("/templates");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
        <Field
          name="name"
          label="Template name"
          defaultValue={initial.name}
          placeholder="e.g. 4-slot ad — Lara"
          required
        />
        <Field
          name="description"
          label="Description (optional)"
          defaultValue={initial.description}
          placeholder="What kind of video this template is for"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-ink/10 bg-white p-5">
        <h2 className="text-sm font-medium">Slots</h2>
        <p className="text-xs text-ink/60">
          The ordered list of blocks every video built from this template will fill. Block
          assignment is constrained by slot type.
        </p>
        <SlotEditor initial={initial.slots} />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "create" ? "Create template" : "Save changes"}
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
