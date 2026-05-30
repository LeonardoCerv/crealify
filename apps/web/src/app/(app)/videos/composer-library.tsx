"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type LibraryBlock = {
  id: string;
  name: string;
  slotType: string;
  script: string | null;
  posterUrl?: string | null;
  estimatedDurationMs?: number | null;
  hasBurnedCaptions?: boolean;
};

const PRIMARY_CATEGORIES = ["opener", "problem", "solution", "demo", "cta"] as const;

const CATEGORY_DOT: Record<string, string> = {
  opener: "bg-amber-400",
  problem: "bg-rose-400",
  solution: "bg-accent-400",
  demo: "bg-emerald-400",
  cta: "bg-orange-400",
  other: "bg-zinc-500",
};

const DT_BLOCK = "application/x-crealify-block-id";

export function ComposerLibrary({ blocks }: { blocks: LibraryBlock[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter((b) =>
      [b.name, b.slotType, b.script ?? ""].some((s) => s.toLowerCase().includes(q)),
    );
  }, [blocks, search]);

  const groups = useMemo(() => {
    const m = new Map<string, LibraryBlock[]>();
    for (const cat of PRIMARY_CATEGORIES) m.set(cat, []);
    m.set("other", []);
    for (const b of filtered) {
      const key = (PRIMARY_CATEGORIES as readonly string[]).includes(b.slotType)
        ? b.slotType
        : "other";
      m.get(key)!.push(b);
    }
    return m;
  }, [filtered]);

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-zinc-800 bg-zinc-900 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
          Blocks
        </h3>
        <Link
          href="/videos/import"
          className="text-[10px] text-zinc-400 underline-offset-2 hover:text-accent-400 hover:underline"
        >
          import →
        </Link>
      </header>
      <div className="border-b border-zinc-800 px-3 py-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-accent-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {blocks.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-700 p-4 text-center text-[11px] text-zinc-500">
            No blocks yet.{" "}
            <Link href="/videos/import" className="text-accent-400 underline">
              Import a video
            </Link>
          </p>
        ) : null}
        <div className="space-y-4">
          {[...PRIMARY_CATEGORIES, "other"].map((cat) => {
            const items = groups.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[cat]}`} />
                  {cat}
                  <span className="text-zinc-600">· {items.length}</span>
                </p>
                <ul className="space-y-1">
                  {items.map((b) => (
                    <LibraryCard key={b.id} block={b} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function LibraryCard({ block }: { block: LibraryBlock }) {
  const durationSec = block.estimatedDurationMs ? block.estimatedDurationMs / 1000 : null;
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DT_BLOCK, block.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex cursor-grab items-stretch gap-2 rounded-md border border-transparent bg-zinc-950/70 p-1.5 transition active:cursor-grabbing hover:border-accent-500/60 hover:bg-zinc-800"
    >
      <div className="relative h-11 w-[72px] shrink-0 overflow-hidden rounded bg-zinc-800">
        {block.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={block.posterUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[8px] uppercase tracking-wider text-zinc-500">
            no thumb
          </div>
        )}
        {durationSec != null ? (
          <span className="absolute right-0.5 bottom-0.5 rounded bg-black/80 px-1 py-px font-mono text-[8px] tabular-nums text-zinc-100">
            {durationSec.toFixed(1)}s
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <p className="truncate text-[11px] font-medium text-zinc-100">{block.name}</p>
        <p className="truncate text-[10px] text-zinc-500">
          {block.script ? block.script.slice(0, 60) : "no script"}
        </p>
      </div>
    </li>
  );
}
