# Crealify

<img src="./project-logo.png" alt="Crealify logo" width="120" />

Remix any short-form video ad you have already shot. Upload it, get it cut into reusable scene blocks, drag the blocks into a timeline, and swap the voice with one click.

Live at [crealify.xyz](https://www.crealify.xyz). Built at Platanus Build Night, Mexico City, May 2026. MIT licensed.

## What it does

1. **Import a video.** Upload one of your existing ads. ElevenLabs Scribe transcribes it, and Claude reads the transcript and proposes section boundaries: Opener, Problem, Solution, Demo, CTA.
2. **Get blocks.** Each accepted section is sliced out of the source video with ffmpeg, stored, and added to your block library as a draggable card.
3. **Compose.** Build a Template (an ordered list of slots) and fill it from the library on a timeline, mixing blocks from different source videos.
4. **Swap the persona.** Pick a Persona (an ElevenLabs voice, optionally an image). Every block that carries a script is re-voiced: the transcript is read in the new voice and ffmpeg muxes the new audio over the original frames, so delivery and timing stay intact.
5. **Render and publish.** Blocks are rendered and cached by content hash, stitched into a final MP4, and can be pushed to Facebook, Instagram Reels and TikTok with generated per-platform copy.

Everything runs on your own API keys (Anthropic, ElevenLabs, Higgsfield, Meta, TikTok). Keys are stored in a per-user vault encrypted with AES-GCM and never logged.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript |
| Auth | Firebase Auth |
| Database | Postgres (Neon) with Drizzle |
| Storage | Cloudflare R2 or any S3-compatible bucket (MinIO locally) |
| Jobs | Inngest (long-running render, transcription and publish steps) |
| Media | ffmpeg via fluent-ffmpeg |
| Transcription and voices | ElevenLabs |
| Segmentation and copy | Anthropic Claude |
| Character video | Higgsfield (lipsync) |

Monorepo with pnpm workspaces:

```
apps/web                 Next.js app, server actions, Inngest functions
packages/db              Drizzle schema and migrations
packages/ffmpeg          slice, probe, mux and concat helpers
packages/integrations    typed clients: anthropic, elevenlabs, higgsfield, meta, tiktok
packages/shared          zod schemas, cache keys, vault, errors
infra/docker-compose.yml Postgres, MinIO and the Inngest dev server
```

## Run it locally

Requirements: Node 20.11+, pnpm 9, Docker.

```bash
pnpm install
cp .env.example .env            # fill in Firebase and a MASTER_KEY (see comments in the file)
pnpm docker:up                  # Postgres on 5433, MinIO on 9000, Inngest dev server
pnpm db:push                    # create the schema
pnpm dev                        # http://localhost:3000
```

Then open Settings in the app and paste your ElevenLabs and Anthropic keys. Those two are enough to import a video and remix it. Higgsfield, Meta and TikTok are optional.

## Deploy

See [DEPLOY.md](./DEPLOY.md): Vercel for the app, Neon for Postgres, Cloudflare R2 for media and Inngest Cloud for jobs, all on free tiers.

## Docs

- [docs/architecture.md](./docs/architecture.md): stack decisions and the render data flow
- [docs/content-system.md](./docs/content-system.md): templates, slots and blocks
- [docs/decisions.md](./docs/decisions.md): what was decided and why
