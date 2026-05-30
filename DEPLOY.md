# Deploy Crealify in ~20 min

The goal: ship a working public URL. Free tiers, four services.

```
        ┌───────────────┐
        │    Vercel     │ ← Next.js app (auto-deploys on push)
        │  /api/inngest │
        └───────┬───────┘
       Postgres │ Storage   Audio + video bytes
                ▼     ▼
        ┌──────────┐  ┌──────────────────┐
        │   Neon   │  │ Cloudflare R2    │
        └──────────┘  └──────────────────┘
                ▲
        Job orchestration
                │
        ┌──────────────┐
        │ Inngest Cloud│ ← polls /api/inngest, fans out renders
        └──────────────┘
```

You'll touch:
1. **Neon** — managed Postgres
2. **Cloudflare R2** — S3-compatible storage
3. **Inngest Cloud** — async job runner
4. **Vercel** — Next.js host
5. **Firebase** — already set up locally, reuse the same project

---

## 1 · Neon (Postgres)

1. Sign in → [console.neon.tech](https://console.neon.tech).
2. **Create project** → name `crealify` → region closest to you.
3. On the project dashboard, **Connection details** → copy the **Pooler** connection string (looks like `postgres://user:pwd@ep-...-pooler.region.aws.neon.tech/neondb`).
4. Note this as `DATABASE_URL`.
5. Open Neon's **SQL Editor** and paste the contents of [the migration block at the bottom of this file](#initial-schema-paste-into-neon-sql-editor). Run it. That sets up the schema; Drizzle's `db:push` is interactive and can't run on Neon directly.

---

## 2 · Cloudflare R2 (storage)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → **Create bucket** → name `crealify-assets`.
2. Bucket → **Settings** → **Public access**: enable **R2.dev subdomain** (gives you a public URL like `https://pub-xxxxxx.r2.dev`). For prod, attach a custom domain later.
3. R2 home → **Manage R2 API Tokens** → **Create API token** → permissions: **Object Read & Write**, scope: this bucket. Copy:
   - Access Key ID → `STORAGE_ACCESS_KEY_ID`
   - Secret Access Key → `STORAGE_SECRET_ACCESS_KEY`
   - Token detail shows your **Account ID** → endpoint is `https://<account-id>.r2.cloudflarestorage.com` → `STORAGE_ENDPOINT`
4. **CORS** (bucket → Settings → CORS Policy) — required for browser uploads:
   ```json
   [
     {
       "AllowedOrigins": ["https://<your-vercel-domain>.vercel.app", "https://crealify.xyz"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
5. Note the public URL from step 2 → `STORAGE_PUBLIC_URL=https://pub-xxxxxx.r2.dev`.

---

## 3 · Inngest Cloud

1. [app.inngest.com](https://app.inngest.com) → **Sign up with GitHub**.
2. Create a new **Environment** named `production`.
3. **Manage** → **Event Keys** → copy → `INNGEST_EVENT_KEY`.
4. **Manage** → **Signing Keys** → copy → `INNGEST_SIGNING_KEY`.
5. Leave the "Apps" page open — we'll register the Vercel deployment URL here after step 4.

---

## 4 · Vercel (Next.js)

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick `LeonardoCerv/crealify`.
2. **Configure project**:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: leave default (`next build`)
   - **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
3. **Environment Variables** — paste these. Replace bracketed values with what you collected above.
   ```
   DATABASE_URL=postgres://...neon.tech/neondb?sslmode=require

   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDhEu6_DWcRyVHuUtIDbaIGWYIch8aD7F8
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=crealify-46130.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=crealify-46130
   NEXT_PUBLIC_FIREBASE_APP_ID=1:672522114542:web:0c8536aa6f2bbb7766eaff
   FIREBASE_ADMIN_CREDENTIALS=<paste the single-line JSON from your local .env, including the outer quotes>

   STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   STORAGE_REGION=auto
   STORAGE_BUCKET=crealify-assets
   STORAGE_ACCESS_KEY_ID=<from R2>
   STORAGE_SECRET_ACCESS_KEY=<from R2>
   STORAGE_PUBLIC_URL=https://pub-xxxxxx.r2.dev

   INNGEST_EVENT_KEY=<from Inngest>
   INNGEST_SIGNING_KEY=<from Inngest>
   INNGEST_DEV=0

   MASTER_KEY=<copy from your local .env>

   NEXT_PUBLIC_APP_URL=https://<your-project>.vercel.app
   ```
   - **Set `MASTER_KEY` to the SAME value as local** — otherwise the encrypted BYOK tokens in the DB are unreadable. If you want a fresh key for prod, run the generator locally and you'll need to re-enter every BYOK token in `/settings` after deploy.
4. Click **Deploy**. First build takes ~3 min.

### Wire Inngest to Vercel

5. Once deploy succeeds, copy the prod URL.
6. Back in Inngest Cloud → **Apps** → **Sync new app** → paste `https://<your-project>.vercel.app/api/inngest` → confirm. Inngest now discovers `renderBlock`, `renderVideo`, `assembleVideo`, `publishVideo` automatically.

### Firebase prod step

7. Firebase Console → **Authentication** → **Settings** → **Authorized domains** → add `<your-project>.vercel.app`. Email/password sign-in will reject auth from unlisted domains.

---

## 5 · Verify

- `https://<project>.vercel.app/` → landing page renders
- `/login` → sign in
- `/settings` → paste your Anthropic + ElevenLabs keys → verify ticks green
- `/personas` → create one with image upload + Spanish voice
- `/videos/import` → upload a video → analyze → save
- `/videos/new` → drag blocks onto timeline → pick persona → save → render → download

---

## Honest perf notes

- **Vercel Hobby = 60s function timeout**. Persona swap for 4–5 imported clips totals 30–90s. If a render hangs at `running` and never completes, you're hitting that. **Pro tier raises it to 300s** and the included `apps/web/vercel.json` sets `maxDuration: 300` for `/api/inngest`. Free workaround: run Inngest on a separate Render or Railway worker (`apps/worker` would just import the same functions and serve on a non-Vercel host). Ping me if you want that wired.
- Inngest Cloud's free tier covers way more than you'll use during the demo (50k function steps/month).
- Neon free is 0.5 GB storage — plenty for the metadata you'll store. The video bytes live in R2, not Postgres.
- R2 free is 10 GB storage + 10M reads/month. A typical imported video is ~10 MB; you'll fit hundreds of demo runs in the free tier.

---

## Initial schema (paste into Neon SQL editor)

This mirrors Drizzle's generated migration. Run once on a fresh DB.

```sql
CREATE TYPE "public"."integration_provider" AS ENUM('higgsfield', 'elevenlabs', 'anthropic', 'openai', 'meta', 'tiktok');
CREATE TYPE "public"."block_source" AS ENUM('higgsfield_lipsync', 'higgsfield_dop', 'higgsfield_motion_control', 'screen_recording', 'upload', 'broll_stock', 'ai_image_to_video');
CREATE TYPE "public"."aspect_ratio" AS ENUM('9:16', '1:1', '16:9');
CREATE TYPE "public"."video_status" AS ENUM('draft', 'rendering', 'ready_to_publish', 'publishing', 'published', 'failed');
CREATE TYPE "public"."render_status" AS ENUM('pending', 'running', 'succeeded', 'failed');
CREATE TYPE "public"."platform" AS ENUM('facebook', 'instagram', 'tiktok');
CREATE TYPE "public"."publish_status" AS ENUM('queued', 'publishing', 'succeeded', 'failed');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "firebase_uid" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "display_name" text,
  "photo_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "integration_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" "integration_provider" NOT NULL,
  "label" text,
  "encrypted_secret" text NOT NULL,
  "metadata" text,
  "last_verified_at" timestamptz,
  "last_error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "integration_tokens_user_provider_idx" ON "integration_tokens" ("user_id", "provider");

CREATE TABLE "characters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "soul_id" text,
  "reference_image_url" text,
  "default_preset" text,
  "voice_provider" text NOT NULL DEFAULT 'elevenlabs',
  "voice_external_id" text,
  "voice_settings" jsonb,
  "notes" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "voices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "provider" text NOT NULL DEFAULT 'elevenlabs',
  "external_id" text NOT NULL,
  "default_character_id" uuid REFERENCES "characters"("id") ON DELETE SET NULL,
  "settings" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slot_type" text NOT NULL,
  "source" "block_source" NOT NULL,
  "script" text,
  "features_character" integer NOT NULL DEFAULT 1,
  "estimated_duration_ms" integer,
  "uploaded_asset_url" text,
  "poster_url" text,
  "has_burned_captions" integer NOT NULL DEFAULT 0,
  "config" jsonb DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "slots" jsonb NOT NULL DEFAULT '[]',
  "global_overlays" jsonb DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "templates"("id") ON DELETE RESTRICT,
  "character_id" uuid REFERENCES "characters"("id") ON DELETE SET NULL,
  "voice_id" uuid REFERENCES "voices"("id") ON DELETE SET NULL,
  "aspect" "aspect_ratio" NOT NULL DEFAULT '9:16',
  "status" "video_status" NOT NULL DEFAULT 'draft',
  "bindings" jsonb NOT NULL DEFAULT '[]',
  "final_asset_url" text,
  "copy" jsonb DEFAULT '{}',
  "error" text,
  "parent_video_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "block_renders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "block_id" uuid NOT NULL REFERENCES "blocks"("id") ON DELETE CASCADE,
  "cache_key" text NOT NULL,
  "cache_inputs" jsonb NOT NULL,
  "status" "render_status" NOT NULL DEFAULT 'pending',
  "asset_url" text,
  "duration_ms" integer,
  "external_job_id" text,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
CREATE UNIQUE INDEX "block_renders_cache_key_idx" ON "block_renders" ("cache_key");

CREATE TABLE "publishes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "video_id" uuid NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
  "platform" "platform" NOT NULL,
  "status" "publish_status" NOT NULL DEFAULT 'queued',
  "external_post_id" text,
  "external_post_url" text,
  "caption_snapshot" jsonb,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
```
