"use client";

import { useMemo, useState } from "react";

export type Slot = {
  id: string;
  slotType: string;
  label: string;
  maxDurationMs?: number;
  transitionOut?: "cut" | "crossfade" | "slide_left" | "fade";
  notes?: string;
};

const TRANSITIONS = ["cut", "crossfade", "slide_left", "fade"] as const;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "slot"
  );
}

function uniqueId(base: string, existing: Set<string>): string {
  let id = base;
  let n = 2;
  while (existing.has(id)) {
    id = `${base}_${n++}`;
  }
  return id;
}

/**
 * Renders a slot list, lets the user add/remove/rename slot rows. Emits the
 * full slot array as a hidden `slots` JSON form field so the server action
 * can parse it in one shot.
 */
export function SlotEditor({ initial }: { initial: Slot[] }) {
  const [slots, setSlots] = useState<Slot[]>(initial.length ? initial : []);

  const hidden = useMemo(() => JSON.stringify(slots), [slots]);

  function addSlot() {
    const ids = new Set(slots.map((s) => s.id));
    const base = slugify("slot");
    setSlots((s) => [
      ...s,
      {
        id: uniqueId(base, ids),
        slotType: "custom",
        label: "New slot",
        maxDurationMs: 10000,
        transitionOut: "cut",
      },
    ]);
  }

  function addQuick(slotType: string, label: string, maxDurationMs: number) {
    const ids = new Set(slots.map((s) => s.id));
    setSlots((s) => [
      ...s,
      { id: uniqueId(slugify(slotType), ids), slotType, label, maxDurationMs, transitionOut: "cut" },
    ]);
  }

  function update(idx: number, patch: Partial<Slot>) {
    setSlots((s) => s.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function move(idx: number, dir: -1 | 1) {
    setSlots((s) => {
      const next = [...s];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return s;
      const tmp = next[idx];
      const other = next[target];
      if (!tmp || !other) return s;
      next[idx] = other;
      next[target] = tmp;
      return next;
    });
  }

  function remove(idx: number) {
    setSlots((s) => s.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="slots" value={hidden} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink/60">Quick add:</span>
        <QuickButton onClick={() => addQuick("opener", "Opener (Hook)", 4000)}>
          Opener
        </QuickButton>
        <QuickButton onClick={() => addQuick("problem", "Problem", 6000)}>
          Problem
        </QuickButton>
        <QuickButton onClick={() => addQuick("solution", "Solution", 12000)}>
          Solution
        </QuickButton>
        <QuickButton onClick={() => addQuick("demo", "Demo / Proof", 10000)}>
          Demo
        </QuickButton>
        <QuickButton onClick={() => addQuick("cta", "CTA", 5000)}>CTA</QuickButton>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 p-6 text-center text-sm text-ink/50">
          No slots yet. Use the quick-add buttons above, or click <em>Add a custom slot</em>.
        </div>
      ) : (
        <ol className="space-y-2">
          {slots.map((slot, idx) => (
            <li key={slot.id} className="rounded-lg border border-ink/10 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SmallField
                  label="Label"
                  value={slot.label}
                  onChange={(v) => update(idx, { label: v })}
                />
                <SmallField
                  label="Slot type"
                  value={slot.slotType}
                  onChange={(v) => update(idx, { slotType: slugify(v) })}
                />
                <SmallField
                  label="Max duration (ms)"
                  type="number"
                  value={String(slot.maxDurationMs ?? "")}
                  onChange={(v) => update(idx, { maxDurationMs: v ? Number(v) : undefined })}
                />
                <SmallSelect
                  label="Transition out"
                  value={slot.transitionOut ?? "cut"}
                  onChange={(v) => update(idx, { transitionOut: v as Slot["transitionOut"] })}
                  options={TRANSITIONS.map((t) => ({ value: t, label: t }))}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-ink/60">
                <span>
                  <span className="font-mono text-ink/40">#{idx + 1}</span>{" "}
                  <span className="font-mono text-ink/40">{slot.id}</span>
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="rounded-full border border-ink/15 px-2 py-0.5 text-[11px] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === slots.length - 1}
                    className="rounded-full border border-ink/15 px-2 py-0.5 text-[11px] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="rounded-full border border-red-200 px-2 py-0.5 text-[11px] text-red-700"
                  >
                    Remove
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={addSlot}
        className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
      >
        + Add a custom slot
      </button>
    </div>
  );
}

function QuickButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-ink/15 bg-paper px-3 py-1 text-[11px] hover:bg-ink/5"
    >
      + {children}
    </button>
  );
}

function SmallField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-ink/70">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink/40"
      />
    </label>
  );
}

function SmallSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-xs">
      <span className="text-ink/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-ink/15 bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
