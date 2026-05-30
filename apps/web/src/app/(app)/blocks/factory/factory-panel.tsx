"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlockSource } from "@crealify/db";
import type { HookVariant } from "@crealify/anthropic";
import { acceptVariantsAction, generateHookVariantsAction } from "./actions";

const SOURCES: { value: BlockSource; label: string }[] = [
  { value: "higgsfield_lipsync", label: "Higgsfield — lipsync" },
  { value: "higgsfield_dop", label: "Higgsfield — DoP" },
  { value: "higgsfield_motion_control", label: "Higgsfield — motion control" },
];

export function FactoryPanel({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [variants, setVariants] = useState<HookVariant[]>([]);
  const [slotType, setSlotType] = useState("opener");
  const [source, setSource] = useState<BlockSource>("higgsfield_lipsync");
  const [featuresCharacter, setFeaturesCharacter] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [namesByIdx, setNamesByIdx] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("slotType", slotType);
    setMessage(null);
    startTransition(async () => {
      const res = await generateHookVariantsAction(form);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        setVariants([]);
        return;
      }
      setVariants(res.variants);
      setSelected(new Set(res.variants.map((_, i) => i)));
      setNamesByIdx(
        Object.fromEntries(res.variants.map((_, i) => [i, `${slotType} variant ${i + 1}`])),
      );
    });
  }

  function toggleSelected(idx: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function onAccept() {
    const items = [...selected]
      .map((idx) => {
        const v = variants[idx];
        if (!v) return null;
        return { name: namesByIdx[idx] ?? `Variant ${idx + 1}`, script: v.script };
      })
      .filter((v): v is { name: string; script: string } => v !== null);
    if (items.length === 0) {
      setMessage({ ok: false, text: "Pick at least one variant to save." });
      return;
    }
    startTransition(async () => {
      const res = await acceptVariantsAction({
        slotType,
        source,
        featuresCharacter,
        variants: items,
      });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: `Saved ${res.created} block${res.created === 1 ? "" : "s"}.` });
      router.push("/blocks");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onGenerate}
        className="space-y-3 rounded-lg border border-ink/10 bg-white p-5"
      >
        <fieldset disabled={disabled} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-ink/70">Slot type</span>
              <input
                value={slotType}
                onChange={(e) => setSlotType(e.target.value)}
                placeholder="opener · problem · solution · demo · cta"
                className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
                required
              />
            </label>
            <label className="block text-xs">
              <span className="text-ink/70">Number of variants</span>
              <input
                type="number"
                name="count"
                defaultValue={5}
                min={1}
                max={10}
                className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
              />
            </label>
          </div>

          <label className="block text-xs">
            <span className="text-ink/70">Brief</span>
            <textarea
              name="brief"
              rows={5}
              placeholder="Describe your product, audience, and the angle you want."
              className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
              required
              minLength={20}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-ink/70">Language</span>
              <input
                name="language"
                defaultValue="English"
                className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
              />
            </label>
            <label className="block text-xs">
              <span className="text-ink/70">Style notes (optional)</span>
              <input
                name="styleNotes"
                placeholder="e.g. casual, contrarian, no exclamation marks"
                className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={pending || disabled}
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper disabled:opacity-50"
          >
            {pending ? "Generating…" : "Generate variants"}
          </button>
          {message ? (
            <span
              className={`ml-3 text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}
            >
              {message.text}
            </span>
          ) : null}
        </fieldset>
      </form>

      {variants.length > 0 ? (
        <div className="space-y-4 rounded-lg border border-ink/10 bg-white p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Variants ({variants.length})</h2>
            <p className="text-[11px] text-ink/50">
              {selected.size} selected
            </p>
          </header>

          <ul className="space-y-3">
            {variants.map((v, idx) => (
              <li
                key={idx}
                className={`rounded-md border p-3 ${
                  selected.has(idx) ? "border-ink/40 bg-paper-50" : "border-ink/10"
                }`}
              >
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(idx)}
                    onChange={() => toggleSelected(idx)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      value={namesByIdx[idx] ?? `Variant ${idx + 1}`}
                      onChange={(e) =>
                        setNamesByIdx((m) => ({ ...m, [idx]: e.target.value }))
                      }
                      className="block w-full rounded-md border border-ink/15 bg-paper px-2 py-1 text-xs text-ink/80 outline-none focus:border-ink/40"
                    />
                    <p className="whitespace-pre-wrap text-sm">{v.script}</p>
                    {v.rationale ? (
                      <p className="text-[11px] italic text-ink/50">↳ {v.rationale}</p>
                    ) : null}
                  </div>
                </label>
              </li>
            ))}
          </ul>

          <div className="space-y-3 border-t border-ink/10 pt-4">
            <p className="text-xs text-ink/70">Save selected variants as blocks with:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="text-ink/70">Source</span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as BlockSource)}
                  className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
                >
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={featuresCharacter}
                  onChange={(e) => setFeaturesCharacter(e.target.checked)}
                />
                Features the character
              </label>
            </div>
            <button
              type="button"
              onClick={onAccept}
              disabled={pending || selected.size === 0}
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper disabled:opacity-50"
            >
              {pending ? "Saving…" : `Save ${selected.size || ""} block${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
