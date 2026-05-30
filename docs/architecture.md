# Architecture (v1)

> Locked 2026-05-29. Project: **Crealify** · crealify.xyz.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend / API | **Next.js 15 (App Router) + TypeScript** | One framework for UI + server actions + API routes. Deployable to Vercel. |
| Auth | **Firebase Auth** | User pick. Mature, free at our scale, drop-in. |
| Database | **Postgres on Neon** | Serverless Postgres, branching for previews, generous free tier. |
| ORM | **Drizzle** | TS-first, no codegen overhead, great DX. |
| Storage | **Cloudflare R2** (or Firebase Storage) | Per-user assets, render outputs, S3-compatible, cheap egress. Decide based on auth pick. |
| Job queue | **Inngest** | Built for long-running multi-step jobs (Higgsfield calls are async + slow). Retries, fan-out, fan-in. |
| Video composition | **Remotion** | React-based, programmatic, open-source, deployable. Handles captions, B-roll overlays, transitions. |
| Fast media ops | **ffmpeg** (via `fluent-ffmpeg`) | Trim, concat, transcode, audio mux. Wrapped behind a small service. |
| LLM (script/copy) | **Anthropic Claude** (default) + OpenAI fallback | User has Anthropic access; per-user BYOK. |
| Video AI | **Higgsfield Cloud API** | Per-user BYOK token. We call the HTTP API directly, not the MCP. |
| Voice | **ElevenLabs HTTP API** | Per-user BYOK. |
| Publishing | **Meta Graph API**, **TikTok Content Posting API** | Per-user OAuth tokens stored encrypted. |
| Secrets | **Per-user encrypted vault** | AES-GCM with a server-held KEK; user tokens never logged. |

## High-level layout

```
apps/
  web/                     # Next.js 15 app — UI, server actions, API routes
  worker/                  # Inngest functions — Higgsfield jobs, render jobs, publish jobs
packages/
  db/                      # Drizzle schema + migrations
  integrations/            # Typed clients
    higgsfield/
    elevenlabs/
    meta/
    tiktok/
    anthropic/
  remotion/                # Remotion compositions (Hook scene, Caption overlays, Transitions)
  ffmpeg/                  # ffmpeg pipeline helpers (concat, trim, transcode, mux)
  shared/                  # Types, zod schemas, constants
infra/
  docker-compose.yml       # Local dev: Postgres, MinIO (R2-compatible), Inngest dev
```

Monorepo: pnpm workspaces. No Turborepo needed at this size; can add later.

## Data flow: creating a video

```
[User UI]
   │  1. Pick Template, bind blocks, pick Character + Voice
   ▼
[Next.js server action]
   │  2. Insert Video row, enqueue Inngest event 'video.render.requested'
   ▼
[Inngest function: renderVideo]
   │  3. For each slot:
   │     a. Compute render cache key (block × character × voice × bgVariant × aspect)
   │     b. If cached MP4 exists → reuse
   │     c. Else → enqueue 'block.render.requested'
   │  4. Wait for all block renders
   │  5. Enqueue 'video.assemble.requested'
   ▼
[Inngest function: renderBlock]
   │  6. For Higgsfield-generated blocks:
   │     - Submit job to Higgsfield Cloud API
   │     - Poll until complete (Inngest 'step.waitForEvent' or 'step.sleep')
   │     - Download MP4 to R2
   │  7. For ElevenLabs voice tracks:
   │     - TTS request, store WAV/MP3
   │  8. For uploaded screen recordings:
   │     - Already in R2, just reference
   │  9. Persist render to DB with content hash
   ▼
[Inngest function: assembleVideo]
   │ 10. Render Remotion composition with the per-slot MP4s
   │ 11. ffmpeg pass for final transcode + audio mix + captions burn-in
   │ 12. Upload final MP4 to R2
   │ 13. Generate post copy (Anthropic call: title + per-platform captions + hashtags)
   │ 14. Mark Video status = 'ready_to_publish'
   ▼
[User UI]
   │ 15. Approval modal: preview + per-platform copy
   │ 16. On confirm → enqueue 'video.publish.requested'
   ▼
[Inngest function: publishVideo]
   │ 17. Parallel: Meta Graph (FB), Meta Graph (IG Reels), TikTok Content Posting
   │ 18. Persist per-platform post IDs + URLs
```

## Render caching

Cache key (content-addressed):
```
sha256(
  blockId
  + characterId
  + voiceId
  + backgroundVariantId
  + aspectRatio
  + scriptHash
  + higgsfieldModelVersion
)
```
Stored as `renders` row with `cacheKey UNIQUE`. Any video whose binding produces an existing key reuses the MP4 — render cost is one Higgsfield call, ever, per unique combination.

**Invalidation**: when a Block's script is edited, the new `scriptHash` produces a new cacheKey. Old renders remain (no orphan cleanup in v1; cron later). Videos pointing to that block get a "block changed — re-render?" indicator.

## Security — BYOK vault

- Each integration token (Higgsfield, ElevenLabs, Meta, TikTok, Anthropic) is stored encrypted in Postgres.
- Encryption: AES-256-GCM, key in `ENV.MASTER_KEY` (rotated via re-encrypt migration when needed).
- Tokens decrypted only inside Inngest functions on demand; never logged, never sent to client.
- Token health checks run nightly per user; broken tokens surface in UI.

## Out of scope for v1
- Ad campaign management (targeting, budget, A/B testing in Meta Ads Manager).
- Batch / matrix generation (5 hooks × 3 characters × 2 personas).
- Persona entity.
- Analytics dashboard (impressions, retention, conversions).
- Team accounts / multi-seat.
- Scheduled posting (we have approval modal; scheduled posting is v1.1).
- Voice cloning UI (use ElevenLabs voices the user already has).
