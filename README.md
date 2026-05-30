# Crealify

> Remix the short-form video ads you've already shot.
>
> Open source · [crealify.xyz](https://crealify.xyz) · MIT

Crealify is a video editor for marketers and creators who already have short-form ads sitting on their phones. You upload one video, Crealify segments it into reusable **Blocks** (Opener, Problem, Solution, Demo, CTA), and then you remix it on a CapCut-style timeline — drag a new hook in, keep the demo, swap the CTA. When you want a different on-camera person and voice, you pick a **Persona** and Crealify rebuilds every clip using ElevenLabs speech-to-speech to swap the voice while preserving the original delivery. Final cut downloads as an MP4.

## What's in the box

- **Import** — upload any MP4 / MOV / WebM. ElevenLabs **Scribe** transcribes it with timestamps; Claude reads the transcript and proposes 3–5 section boundaries (Opener / Problem / Solution / Demo / CTA). You review the cuts on a **dark, draggable timeline**, save them as Blocks.
- **Compose** — a CapCut-style editor: block library on the left, video preview on the top-right, timeline on the bottom. Drag blocks from the library onto the timeline, drag clips around to reorder, zoom in/out, scrub the ruler, spacebar plays. Each clip shows its slot type, name, and duration.
- **Persona swap** — a Persona is an image + an ElevenLabs voice. When applied to a video, every script-bearing clip gets rebuilt: ffmpeg extracts the original audio, ElevenLabs **speech-to-speech** swaps it into the new voice (preserves pacing, prosody, and emotion), then ffmpeg muxes the new audio back over the original video frames. The final assembly is automatic.
- **Render & download** — Inngest orchestrates the per-block renders and the final concat. When the assembly finishes, you preview the MP4 in-app and download it.

## Stack

| Layer | Choice |
|---|---|
| Frontend / API | Next.js 15 (App Router) + TypeScript |
| Auth | Firebase Auth (email + password) |
| Database | Postgres + Drizzle ORM |
| Storage | S3-compatible (Cloudflare R2 in prod, MinIO locally) |
| Job queue | Inngest |
| Speech-to-text | ElevenLabs Scribe |
| Speech-to-speech | ElevenLabs |
| LLM | Anthropic Claude (segmentation) |
| Media | ffmpeg (slice, mux, concat, captions) |
| Encryption | AES-256-GCM per-user vault for all API keys (BYOK) |

## Get the API keys you need

1. **Anthropic** — [console.anthropic.com](https://console.anthropic.com/settings/keys) → Create Key
2. **ElevenLabs** — [elevenlabs.io](https://elevenlabs.io/app/settings/api-keys) → API key. Required for Scribe (transcription) and the speech-to-speech persona swap.

That's it for the MVP. Other integrations (Meta, TikTok, Higgsfield) are scaffolded but optional.

## Local setup

Prereqs: Node ≥ 20.11, pnpm 9.x, Docker.

```bash
pnpm install
cp .env.example .env                 # fill Firebase + MASTER_KEY
pnpm docker:up                       # Postgres + MinIO + Inngest dev
pnpm db:push                         # apply schema (interactive — pick "execute")
pnpm dev                             # → http://localhost:3002
```

Generate `MASTER_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Firebase Auth setup:

1. Create a Firebase project, enable **Email/Password** auth.
2. Copy the web config into `NEXT_PUBLIC_FIREBASE_*` env vars.
3. Generate an Admin SDK service-account JSON and paste it (single-line) into `FIREBASE_ADMIN_CREDENTIALS`.

## Repo layout

```
apps/web/                            Next.js app
packages/
  db/                                Drizzle schema + lazy client
  shared/                            cache-key hashing, AES-GCM vault
  ffmpeg/                            concat, slice, mux, poster, captions
  integrations/
    anthropic/                       Claude wrapper (segmentation via tool use)
    elevenlabs/                      Scribe + TTS + speech-to-speech
    higgsfield/                      Soul ID / Lipsync / DoP (scaffolded)
    meta/                            Facebook + Instagram (scaffolded)
    tiktok/                          Content Posting (scaffolded)
infra/docker-compose.yml             Postgres + MinIO + Inngest dev
```

## License

MIT.
