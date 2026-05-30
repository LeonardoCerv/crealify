import Link from "next/link";
import { CrealifyLockup, CrealifyMark, CrealifySparkle } from "@/components/brand/logo";

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <header className="flex items-center justify-between py-6">
        <div className="text-ink">
          <CrealifyLockup size="sm" />
        </div>
        <nav className="flex items-center gap-4 text-xs text-ink/70">
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            GitHub
          </a>
          <Link
            href="/login"
            className="rounded-full bg-ink px-3.5 py-1.5 font-medium text-paper hover:bg-ink/90"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section className="py-20">
        <p className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink/50">
          <CrealifySparkle className="text-accent" />
          open source · BYOK · self-hostable
        </p>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Make the same ad <span className="text-ink/40">in 20 ways.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink/70">
          Crealify composes short-form video ads from reusable blocks —{" "}
          <strong>Opener · Problem · Solution · Demo · CTA</strong>. Swap a hook, keep the demo + CTA cached, and
          ship variants in seconds. Powered by Higgsfield characters, ElevenLabs voices, Claude
          scripts, and one-click publishing to Facebook, Instagram, and TikTok.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink/90"
          >
            Try it
          </Link>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ink/5"
          >
            View source
          </a>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 md:grid-cols-2">
        <FeatureCell
          title="Block library"
          body="Build a library of typed reusable blocks (Opener, Problem, Solution, Demo, CTA). Every block can drive many videos."
        />
        <FeatureCell
          title="Render cache"
          body="Content-addressed by character × voice × aspect × script. Reuse the same block → zero re-render cost."
        />
        <FeatureCell
          title="Hook factory"
          body="Generate 5–10 hook variants with Claude in one shot. Accept the winners as new blocks."
        />
        <FeatureCell
          title="Character consistency"
          body="Higgsfield Soul ID locks identity across every clip. Same character, every block."
        />
        <FeatureCell
          title="Lipsync + Voice"
          body="ElevenLabs voices feed Higgsfield lipsync to produce talking-character clips without filming yourself."
        />
        <FeatureCell
          title="One-click publish"
          body="Approval modal with per-platform captions, then publish to Facebook, Instagram Reels, and TikTok in parallel."
        />
      </section>

      <section className="py-16">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 space-y-4 text-sm text-ink/80">
          <Step
            n={1}
            title="Connect APIs"
            body="Bring your own keys — Higgsfield, ElevenLabs, Anthropic, Meta, TikTok. Stored encrypted with AES-256-GCM and never logged."
          />
          <Step
            n={2}
            title="Register characters + voices"
            body="Train a Higgsfield Soul ID in their UI, paste the ID into Crealify. Add ElevenLabs voice IDs."
          />
          <Step
            n={3}
            title="Build the block library"
            body="Write scripts (or use the Hook Factory). Upload screen recordings. Tag each block by slot type."
          />
          <Step
            n={4}
            title="Compose a video"
            body="Pick a template, bind blocks to slots, choose character + voice + aspect. Render. Captions burn in automatically."
          />
          <Step
            n={5}
            title="Ship variants in seconds"
            body="Clone + swap one block. The unchanged blocks render from cache; only the new one renders from scratch."
          />
        </ol>
      </section>

      <footer className="flex items-center justify-between border-t border-ink/10 py-8 text-xs text-ink/50">
        <div className="flex items-center gap-2">
          <CrealifyMark size="sm" />
          <span>crealify.xyz · MIT</span>
        </div>
        <span>Built to be self-hosted.</span>
      </footer>
    </div>
  );
}

function FeatureCell({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-paper p-6">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-xs text-ink/60">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-lg border border-ink/10 bg-white p-5">
      <div className="flex items-start gap-4">
        <span className="rounded-full border border-ink/15 px-2.5 py-0.5 text-[11px] font-mono text-ink/60">
          {String(n).padStart(2, "0")}
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-ink/60">{body}</p>
        </div>
      </div>
    </li>
  );
}
