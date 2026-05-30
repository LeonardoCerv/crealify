# v1 scope and phased milestones

> User picked "Full v1" — character training UI, blocks, swap, publish, copy gen. Realistic estimate: **5–6 weeks of focused work** for a working open-source release. Phased so each milestone is independently demoable.

## Phase 0 — Project bootstrap (1–2 days)
- pnpm monorepo, Next.js 15 app, Drizzle + Neon, Firebase Auth.
- Docker Compose for local Postgres + MinIO + Inngest dev.
- CI: typecheck, lint, drizzle migration check.
- Landing page + auth flow + empty dashboard.

**Demoable**: log in, see empty dashboard.

## Phase 1 — BYOK + Characters (1 week)
- Settings UI: paste in Higgsfield, ElevenLabs, Anthropic, Meta, TikTok tokens. Stored encrypted.
- Token health checks per integration.
- **Character entity**: connect an existing Soul ID by ID (no in-app training in this phase — user trains via Higgsfield UI then pastes the Soul ID).
- Character list page with reference image preview.

**Demoable**: connect APIs, register an existing Soul ID as a Character.

## Phase 2 — Templates + Blocks (1 week)
- Template editor: name, ordered list of editable slots (default 4: Opener / Body / Proof / CTA).
- Block CRUD per type:
  - **Generated block** (e.g. Hook, Body, CTA): script text + which character will appear + voice + aspect ratio. No render yet.
  - **Upload block** (Demo): upload screen recording, trim handles.
- Script-writing assistant: Anthropic call with prompt scaffolding per slot type ("write me 5 hooks for X persona").

**Demoable**: build a Template, fill it with blocks, see a "draft Video" preview structure (no renders yet).

## Phase 3 — Render pipeline (1.5 weeks)
- Higgsfield client (Soul + Lipsync Studio + DoP + Audio).
- Inngest functions: `renderBlock`, `assembleVideo`.
- Render cache table + content-hash keying.
- Remotion compositions for: scene container, caption overlay, transition library.
- ffmpeg concat + transcode + audio mix.
- Final video preview in the UI with frame-accurate scrubber.

**Demoable**: hit "Render", get a finished MP4 with captions.

## Phase 4 — Publishing + approval (1 week)
- Meta Graph publishing (FB Page + IG Reel).
- TikTok Content Posting publishing.
- Copy generation (Anthropic): title + per-platform caption + hashtags.
- Approval modal: video preview + editable per-platform copy + per-platform toggle.
- Publish results page: links to live posts.

**Demoable**: end-to-end — make a block, render, approve, posts go live on all three.

## Phase 5 — Variation & polish (3–4 days)
- "Clone & swap" action on any Video (your main reuse flow).
- Background-variant swap on Demo blocks (Higgsfield-generated environments).
- "Block changed — re-render?" indicators where renders are stale.
- Onboarding tour.
- README + landing page for open-source release.

**Demoable**: clone an existing video, change the Hook, ship a variant in under 2 minutes.

## Explicitly deferred to v1.1+
- Batch generator (N hooks at once).
- Matrix generator (hooks × characters × personas).
- Persona entity.
- In-app Soul ID training UI (until then: train in Higgsfield UI, paste ID).
- Scheduled posting.
- Ad campaign config.
- Analytics dashboard.
- Team accounts.
