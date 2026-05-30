import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listVideos } from "@/lib/videos";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-ink/5 text-ink/60",
  rendering: "bg-amber-50 text-amber-800",
  ready_to_publish: "bg-emerald-50 text-emerald-800",
  publishing: "bg-amber-50 text-amber-800",
  published: "bg-emerald-100 text-emerald-900",
  failed: "bg-red-50 text-red-700",
};

export default async function VideosPage() {
  const userId = await requireUserId();
  const videos = await listVideos(userId);

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Videos</h1>
          <p className="mt-1 text-sm text-ink/60">
            Every video is a binding of blocks to a template. Cloning + swapping a block produces a
            new variant in seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/videos/import"
            className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
          >
            Import a video
          </Link>
          <Link
            href="/videos/new"
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper"
          >
            New video
          </Link>
        </div>
      </header>

      {videos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/15 p-8 text-center text-sm text-ink/50">
          No videos yet. Compose one from a template + blocks.
        </div>
      ) : (
        <ul className="space-y-3">
          {videos.map((v) => (
            <li key={v.id} className="rounded-lg border border-ink/10 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/videos/${v.id}`} className="text-sm font-medium hover:underline">
                  {v.name}
                </Link>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wide ${
                    STATUS_COLORS[v.status] ?? "bg-ink/5 text-ink/60"
                  }`}
                >
                  {v.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink/50">
                aspect {v.aspect} · {v.bindings.length} block{v.bindings.length === 1 ? "" : "s"} bound
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
