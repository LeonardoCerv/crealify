import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listPersonas } from "@/lib/personas";
import { listBlocks } from "@/lib/blocks";
import { listVideos } from "@/lib/videos";
import { listTokenStatuses } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [personas, blocks, videos, tokens] = await Promise.all([
    listPersonas(userId),
    listBlocks(userId),
    listVideos(userId),
    listTokenStatuses(userId),
  ]);
  const verifiedCount = tokens.filter((t) => t.lastVerifiedAt && !t.lastError).length;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-ink/60">
          Import a video → blocks → timeline. Persona swap and publishing on the next screen.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          href="/videos/import"
          title="Import a video"
          subtitle="Whisper + Claude segment your video into Blocks"
          cta="Start importing →"
        />
        <StatCard
          href="/videos"
          title="Videos"
          subtitle={`${videos.length} draft${videos.length === 1 ? "" : "s"}`}
          cta={videos.length === 0 ? "Compose your first video" : "Open videos"}
        />
        <StatCard
          href="/settings"
          title="Integrations"
          subtitle={`${verifiedCount}/${tokens.length} verified`}
          cta="Open settings"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniCard href="/blocks" label="Blocks" count={blocks.length} />
        <MiniCard href="/personas" label="Personas" count={personas.length} />
      </div>

      <p className="text-xs text-ink/40">
        Import a video → blocks → timeline → render. Persona swap and publishing
      </p>
    </section>
  );
}

function StatCard({
  href,
  title,
  subtitle,
  cta,
}: {
  href: string;
  title: string;
  subtitle: string;
  cta: string;
}) {
  return (
    <Link href={href}>
      <div className="rounded-lg border border-ink/10 bg-white p-5 transition hover:border-ink/30">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-ink/60">{subtitle}</p>
        <p className="mt-6 text-xs text-ink/50">{cta} →</p>
      </div>
    </Link>
  );
}

function MiniCard({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link href={href}>
      <div className="rounded-lg border border-ink/10 bg-white p-4 transition hover:border-ink/30">
        <p className="text-2xl font-semibold leading-none">{count}</p>
        <p className="mt-1 text-xs text-ink/60">{label}</p>
      </div>
    </Link>
  );
}
