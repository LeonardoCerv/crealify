import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listBlocks, BLOCK_SOURCES } from "@/lib/blocks";
import type { BlockSource } from "@crealify/db";

export const dynamic = "force-dynamic";

export default async function BlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string; source?: string }>;
}) {
  const { slot, source } = await searchParams;
  const userId = await requireUserId();
  const filter: { slotType?: string; source?: BlockSource } = {};
  if (slot) filter.slotType = slot;
  if (source && BLOCK_SOURCES.some((s) => s.value === source)) filter.source = source as BlockSource;
  const blocks = await listBlocks(userId, filter);

  const allBlocks = await listBlocks(userId);
  const slotTypes = Array.from(new Set(allBlocks.map((b) => b.slotType))).sort();

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Blocks</h1>
          <p className="mt-1 text-sm text-ink/60">
            Reusable units of video. Bind a block to any slot of matching type. The same block can
            appear in many videos — its renders are cached per character × voice × aspect.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/blocks/factory"
            className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
          >
            Hook factory
          </Link>
          <Link
            href="/blocks/new"
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper"
          >
            New block
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Filter label="All" href="/blocks" active={!slot && !source} />
        {slotTypes.map((t) => (
          <Filter key={t} label={t} href={`/blocks?slot=${t}`} active={slot === t} />
        ))}
        <span className="ml-2 text-ink/40">|</span>
        {BLOCK_SOURCES.map((s) => (
          <Filter
            key={s.value}
            label={s.label.split(" — ")[0] ?? s.label}
            href={`/blocks?source=${s.value}`}
            active={source === s.value}
          />
        ))}
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
          {slot || source
            ? "No blocks match that filter."
            : "No blocks yet. Import a video, or create a block manually."}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {blocks.map((b) => {
            const sourceMeta = BLOCK_SOURCES.find((s) => s.value === b.source);
            return (
              <li key={b.id} className="rounded-lg border border-ink/10 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/blocks/${b.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="rounded-full border border-ink/15 bg-paper px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink/60">
                    {b.slotType}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink/50">
                  {sourceMeta?.label ?? b.source}
                </p>
                {b.script ? (
                  <p className="mt-3 line-clamp-3 text-xs text-ink/70">{b.script}</p>
                ) : b.uploadedAssetUrl ? (
                  <p className="mt-3 truncate font-mono text-[11px] text-ink/40">
                    {b.uploadedAssetUrl}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Filter({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-ink/15 bg-paper text-ink/70 hover:bg-ink/5"
      }`}
    >
      {label}
    </Link>
  );
}
