# Crealify

> Domain: **crealify.xyz** · Repo dir: `crealify`. Goal: automate the end-to-end creation and publishing of AI-character-driven short-form video ads/posts.

## What this project does

Automates a manual content workflow the user runs today to produce viral-style short videos featuring a consistent AI character, then publishes them to Facebook, Instagram, and TikTok.

## The manual workflow (what we're automating)

1. **Character creation** — generate an AI character that will appear across videos. Must stay visually consistent over time.
2. **Script generation** — produce a potentially viral script (ChatGPT/Claude). Strong hook is the highest-priority element. Script ends with a pitch for the user's platform.
3. **Scene composition** — place the AI character into a background/scene appropriate for the video.
4. **Live acting** — the user records themselves physically acting out and saying the lines.
5. **Voice replacement** — the user's voice is swapped for an ElevenLabs synthetic voice.
6. **Body replacement** — Higgsfield + motion-control replaces the user's body with the AI character driven by the recorded performance.
7. **Edit** — combine all scenes, add B-rolls, supplementary audio, captions.
8. **Copy generation** — write the post/ad copy.
9. **Publish** — manually upload to Facebook, Instagram, TikTok.

## Target end state

A pipeline where the user:
- Provides minimal input (idea, character reference, performance recording).
- Receives a finished video + post copy.
- Hits **one button to publish to FB / IG / TikTok simultaneously** as organic posts.

Ad campaign configuration is **out of scope for v1** — future enhancement.

## Product shape (decided 2026-05-29)

- **Web UI**, deployable.
- **Open source.**
- **BYOK (bring your own keys)** — every integration is configured per-user in the app: ElevenLabs, Higgsfield, Meta, TikTok, Anthropic/OpenAI, etc.
- Tech stack: TBD (no user preference; I'll recommend).
- Owner already has working access to: ElevenLabs, Higgsfield API/MCP, Meta + TikTok publishing APIs.

## Owner's stated top pain points

1. **Editing** — B-rolls, captions, assembly.
2. **Character consistency** across videos.
3. **Motion-control / body replacement** quality.

Architecture should over-invest in these three.

## Core differentiator: block-based composition

Videos are not authored from scratch — they're **assemblies of typed reusable blocks** (Hook / Explanation / Demo / CTA). Swapping one block produces a new variant in seconds because the others are cached. This unlocks rapid A/B hook testing, persona-targeted batch generation, and near-zero re-edit time.

See `docs/content-system.md` for the data model, render caching strategy, and auto-extraction (per-platform copy, hashtags, thumbnails) after assembly.

## Known tools / services in the stack

- **Higgsfield** — central engine. Owner has paid sub + MCP/CLI/Cloud API access. See `docs/higgsfield-capabilities.md`.
  - Soul ID (character consistency), Soul 2.0 (image gen), DoP (image→video), Motion Control, Lipsync Studio (lipsync-2, Speak v2, Kling Avatar, InfiniteTalk, Veo 3), Higgsfield Audio (TTS + voice swap), Viral Clip Generator, Virality Prediction, Video Analyzer, 30+ models.
  - **Plan to call the Cloud API directly from our backend** (MCP is for in-agent use only).
- **ElevenLabs** — voice synthesis. **Now optional** — Higgsfield Audio can replace it. Keep as a swappable backend if user prefers ElevenLabs voices.
- **Anthropic / OpenAI** — script + copy generation.
- **Meta Graph API (Facebook + Instagram)** — publishing.
- **TikTok Content Posting API** — publishing.

## What Higgsfield covers vs. what we build

Higgsfield covers character, scene, image→video, body/motion replacement, lipsync, voice, viral scoring, and partial editing. We build:
- Project/workflow state and UI.
- Script generation + iteration.
- Multi-scene assembly, B-rolls, captions, transitions.
- Cross-platform publishing (FB / IG / TikTok).
- Orchestration & job queue around Higgsfield calls (Higgsfield jobs are async; we poll).

## Stack (locked 2026-05-29)

Next.js 15 + TS + pnpm monorepo · Firebase Auth · Neon Postgres + Drizzle · Cloudflare R2 (or Firebase Storage) · Inngest · Remotion + ffmpeg · Anthropic SDK · Higgsfield Cloud API · ElevenLabs · Meta Graph + TikTok Content Posting.

See `docs/architecture.md` for full layout, data flow, render caching, and BYOK vault design.

## v1 scope

Phase 0 → 5 (~5–6 weeks). Character (connect-by-Soul-ID) → Templates + Blocks → Render pipeline → Publishing with approval gate → Clone-and-swap variant flow.

See `docs/v1-scope.md` for phased milestones.

## Decision log

See `docs/decisions.md`.
