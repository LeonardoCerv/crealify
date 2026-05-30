# Decision log

Append-only. Each entry: date, decision, alternatives considered, why.

## 2026-05-29 — Project scaffolded
- Working name: `ai-video-studio` (placeholder, pending user input).
- Out of scope for v1: paid ad campaign management.
- Publishing target for v1: organic posts on FB, IG, TikTok via one-click action.

## 2026-05-29 — Product shape
- **Web UI**, not CLI or pure Claude Code skills.
- **Open source**, intended to be deployed (self-host or hosted).
- **BYOK** — users plug in their own API keys for every integration.
- Owner has functioning programmatic access to ElevenLabs, Higgsfield API/MCP, Meta + TikTok publishing APIs.
- Top pain in current workflow: editing, character consistency, motion-control quality. Architecture should bias toward solving these well.

## 2026-05-29 — Architecture choices (locked)
- **Performance mode**: support both. User can either (a) film themselves and use Higgsfield Motion Control to swap body, or (b) skip filming and use Higgsfield Lipsync (Kling Avatar / lipsync-2) driven by a portrait + voice track. Choice is per-project.
- **Voice backend**: ElevenLabs only for v1. Higgsfield Audio remains a known fallback but isn't wired up initially.
- **Editor engine**: Remotion + ffmpeg hybrid. Remotion for compositions / captions / B-roll / transitions; ffmpeg for trim / concat / transcode.
- **Deployment model**: Multi-user from day one with Firebase auth. Each user has an account and their own encrypted BYOK vault. This means we need: Firebase Auth, encrypted key storage at rest, per-user data isolation.

## 2026-05-29 — Final stack (locked)
- Next.js 15 + TypeScript + pnpm monorepo.
- Firebase Auth.
- Neon Postgres + Drizzle ORM.
- Cloudflare R2 (or Firebase Storage) for assets — final pick during Phase 0.
- Inngest for long-running multi-step jobs.
- Remotion for video composition; ffmpeg for fast ops.
- Anthropic SDK (default) for script + copy generation; user-supplied API key.
- Higgsfield Cloud API (HTTP) — not MCP — called from worker.
- ElevenLabs HTTP API.
- Meta Graph API + TikTok Content Posting API for publishing.

## 2026-05-29 — v1 scope (locked)
- Full v1 = character training (connect-by-ID in v1, in-app training v1.1), block CRUD, template editor, render pipeline, publishing with approval modal, copy generation, clone-and-swap.
- Approval modal gates every publish.
- Realistic estimate: 5–6 weeks across Phase 0–5 (see `docs/v1-scope.md`).

## 2026-05-29 — Name (locked)
- **Crealify**. Domain purchased: `crealify.xyz`.
- Repo dir renamed `ai-video-studio` → `crealify`. Workspace packages renamed `@studio/*` → `@crealify/*`.

## 2026-05-29 — Content model: block-based composition
- Videos are not authored from scratch; they are **assemblies of reusable blocks**.
- Default 4-slot template: `Opener → Body → Proof → CTA`. **Slot names, count, and order are user-configurable per template.** Hardcoded slot taxonomy is explicitly avoided.
- Demo blocks: core asset is a screen recording of the user's platform. Background/scene around the demo is AI-swappable via Higgsfield (e.g. beach, mountains). Cache key includes background variant.
- Generating a new variant = swapping one or more blocks. Render cache is keyed by `(blockId × characterId × voiceId × backgroundVariantId × aspect)`.
- **Personas are NOT in v1.** Characters are assumed flexible enough to use any hook with minor tweaks.
- **Batch / matrix generation is NOT in v1.** v1 ships single-video iteration with a "clone + swap block" action. Batch is a v1.1 enhancement.
