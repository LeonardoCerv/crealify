import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listTokenStatuses } from "@/lib/tokens";
import { ImportPanel } from "./import-panel";

export const dynamic = "force-dynamic";

export default async function ImportVideoPage() {
  const userId = await requireUserId();
  const tokens = await listTokenStatuses(userId);
  const elevenlabs = tokens.find((t) => t.provider === "elevenlabs");
  const anthropic = tokens.find((t) => t.provider === "anthropic");
  const ready = !!(elevenlabs?.configured && anthropic?.configured);

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Import a video</h1>
        <p className="mt-1 text-sm text-ink/60">
          Upload a video you&apos;ve already made. ElevenLabs Scribe transcribes it; Claude reads
          the transcript and proposes <em>block boundaries</em> — Hook, Problem, Solution, CTA.
          Review the boundaries, then save them as reusable Blocks you can remix into new videos.
        </p>
      </header>

      {!ready ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          You need both <strong>ElevenLabs</strong> (Scribe transcription) and{" "}
          <strong>Anthropic</strong> (segmentation) configured before importing. Add them in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          first.
        </div>
      ) : null}

      <ImportPanel ready={ready} />
    </section>
  );
}
