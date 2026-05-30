# Crealify — Leonardo Cervantes Pérez — Platanus Build Night — Ciudad de México

**Current project logo:** project-logo.png

<img src="./project-logo.png" alt="Project Logo" width="200" />

Hacker:

- Leonardo Cervantes Pérez ([@LeonardoCerv](https://github.com/LeonardoCerv))

Before submitting:

- ✅ Set a project name, oneliner and description in build-night-project.json
- ✅ Provide a 1000x1000 png project logo, max 500kb (project-logo.png)
- ✅ Provide a concise and to the point readme

---

## What is Crealify

Crealify is an open-source video editor for marketers and creators who already shoot short-form ads. You upload one video, Crealify segments it into reusable **Blocks** (Opener, Problem, Solution, Demo, CTA), and then you remix it on a CapCut-style timeline — drag a new hook in, keep the demo, swap the CTA. When you want a different on-camera voice, you pick a **Persona** (image + ElevenLabs voice) and Crealify rebuilds every clip using ElevenLabs speech-to-speech to swap the voice while preserving the original delivery. Final cut downloads as an MP4.

### How it works

- **Import** — upload any MP4 / MOV / WebM. ElevenLabs **Scribe** transcribes it with timestamps; Claude reads the transcript and proposes 3–5 section boundaries. You review the cuts on a dark, draggable timeline and save them as Blocks.
- **Compose** — block library on the left, video preview top-right, timeline bottom. Drag blocks from the library onto the timeline, drag clips to reorder, zoom, scrub, spacebar plays. Each clip shows its slot type, name, and duration.
- **Persona swap** — a Persona is an image + an ElevenLabs voice. When applied: ffmpeg extracts the original audio, ElevenLabs **speech-to-speech** swaps it to the new voice (preserves pacing/prosody/emotion), ffmpeg muxes the new audio over the original frames, the assembler concats everything into a fresh MP4.
- **Render & download** — Inngest orchestrates per-block renders and the final concat. Preview the MP4 in-app and download it.

### Stack

Next.js 15 + TypeScript · Firebase Auth · Postgres + Drizzle · Cloudflare R2 / MinIO · Inngest · ElevenLabs (Scribe + TTS + speech-to-speech) · Anthropic Claude · ffmpeg · AES-256-GCM per-user BYOK vault.

### Local setup

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

Once running, paste your **Anthropic** and **ElevenLabs** keys in `/settings`. That's everything required for the MVP.

For the full production-deploy walkthrough (Neon + R2 + Inngest Cloud + Vercel), see [`DEPLOY.md`](./DEPLOY.md).

---

## ⚠️ Deploying (Vercel, Render, etc.)

Deploy platforms like **Vercel**, **Render** or **Netlify** can only connect to
repositories **you own** — they can't be granted access to this organization repo.
To deploy while keeping your commits here, mirror your code to a personal repo:

1. Create a **personal** repository on your own GitHub account.
2. Point your local `origin` at **both** repos, so a single `git push` updates each one:

   ```bash
   # this org repo (keep it as a push target)...
   git remote set-url --add --push origin https://github.com/platanus-build-night/platanus-build-night-26-mx-LeonardoCerv.git
   # ...and your personal repo
   git remote set-url --add --push origin https://github.com/<your-user>/<your-repo>.git
   ```

   From now on `git push` sends every commit to **both** repositories.
3. Connect your deploy service (Vercel, Render, …) to your **personal** repo and deploy from there.

Your commits stay mirrored here for judging, while the deploy runs from the repo you control.

Have fun! 🚀
