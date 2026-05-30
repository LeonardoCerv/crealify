# Content system — block-based composition

> The core differentiator of this product. Captured 2026-05-29.

## The insight

The user's content is **highly templated**. Across many videos:
- The **hook** changes.
- The **character** sometimes changes.
- The **background / scene** sometimes changes.
- The **explanation, demo, and CTA** mostly do not change.

Today, editing a single variant means re-doing the whole video. That's the real source of the editing pain. Solving it once at the *editor* level is treating a symptom. The real fix is to make videos **compositions of reusable blocks**.

## Entities

```
User
 ├── Characters          (Soul ID-trained, identity preserved across all blocks)
 ├── Voices              (ElevenLabs voice IDs, can be character-bound)
 ├── Blocks              (typed, reusable units; slot types are user-defined per template)
 ├── Templates           (ordered, user-configurable slots; default 4-slot below)
 └── Videos              (Template + concrete block bindings + character + voice)
       └── Renders       (per-platform: TikTok 9:16, IG Reel 9:16, FB Feed 1:1, etc.)
```

Personas are **not** a v1 entity. Characters are flexible enough to use any hook; persona-driven targeting is a future enhancement.

## Default template

User-confirmed default slot structure: **Opener → Body → Proof → CTA**, where:
- **Opener** = Hook OR Problem framing
- **Body** = Solution OR Explanation
- **Proof** = Demo OR Social Proof
- **CTA**

Slot **names**, count, and order are fully editable per template. The default is a starting point, not a constraint.

## Block

A `Block` is the atomic reusable unit:

```ts
Block {
  id
  type: 'hook' | 'explanation' | 'demo' | 'cta'
  source: 'higgsfield' | 'screen_recording' | 'upload' | 'broll_stock' | 'generated_image_to_video'
  script: string                    // the spoken text, if any
  charactersAllowed: boolean        // does this block feature the character?
  cachedRender: {                   // memoized MP4 per character × voice × aspect ratio
    [characterId × voiceId × aspect]: assetUrl
  }
  metadata: { duration, hookScore?, etc. }
}
```

A **Demo block** is typically a screen recording of the user's platform. The screen-recording asset itself is identical across videos, but the **surrounding scene/background can be AI-swapped** (e.g. "phone in hand on a beach" vs. "phone in hand in mountains"). Modeled as: one core asset + N optional `backgroundVariants` (Higgsfield-generated scenes). Render is keyed by `(blockId, backgroundVariantId, aspect)` so each (demo × background) combo caches separately.

A **Hook block** features the character and is the most-varied. Its cached render depends on `(characterId, voiceId, aspect)` — change any of those and you re-render.

## Template

An ordered sequence of typed slots with transitions and overlays:

```ts
Template {
  id, name
  slots: [
    { type: 'hook',         maxDuration: 3,  transitionOut: 'cut' },
    { type: 'explanation',  maxDuration: 15, transitionOut: 'crossfade' },
    { type: 'demo',         maxDuration: 10, transitionOut: 'cut' },
    { type: 'cta',          maxDuration: 5 },
  ]
  globalOverlays: [captions, watermark, music]
}
```

## Video

An instance:

```ts
Video {
  template: Template
  bindings: {
    hook: Block#42
    explanation: Block#7
    demo: Block#1     // the canonical platform demo
    cta: Block#3
  }
  character: Character     // applied to all blocks where charactersAllowed=true
  voice: Voice
  persona?: Persona        // optional, drives target aspect/copy
  copy: { fb, ig, tiktok }
}
```

## Generation workflows this unlocks

1. **New hook only** — `Video.bindings.hook = newHookBlock`. Only Hook re-renders (~30s). Demo/CTA come straight from cache. Editing time near zero.
2. **Character swap** — change `Video.character`. All blocks where `charactersAllowed=true` re-render. Demo stays cached.
3. **Persona-targeted batch** — given a Persona + a Template, generate N hook variants, then materialize N videos in parallel.
4. **Hook A/B factory** — Generate 20 hooks via LLM, render all, publish, let platform data pick winners.

## Auto-extraction after assembly

Given the finished video + its bindings, the agent generates:
- Title / FB caption / IG caption / TikTok caption (per-platform tone & length).
- Hashtags per platform.
- Suggested posting time (later — needs analytics).
- Suggested thumbnail (Higgsfield image gen with character + hook text).
- Virality score (Higgsfield Virality Prediction on the hook).

## How this compares to ElevenLabs Studio "flows"

ElevenLabs Studio Flows is **audio-centric**: chain TTS, sound design, character voices on a timeline, export an audio asset. Mostly for podcasts, audiobooks, narrative audio.

This product is:
- **Video-centric**, not audio.
- **Ads / short-form / persona-driven**, not narrative.
- Has **character identity** as a first-class entity (Soul ID).
- Has **publishing** to FB / IG / TikTok built in.
- The block library is **specifically modeled around the marketing creative structure** (Hook / Explanation / Demo / CTA), not generic timeline blocks.

Different problem space. Borrow the composability idea, not the architecture.

## Tradeoffs and risks

- **Caching invalidation is the hard part.** If the user updates Demo C, every video that points to it needs a flag indicating cache is stale. Use content-hash addressing on the render output.
- **Character consistency between blocks** depends on Soul ID — if Soul ID drifts across generations, the seams between blocks will show. Lock the Soul ID seed/preset per character.
- **Audio continuity across blocks** — different blocks may have different background music / room tone. We need a global audio bed pass at assembly time so transitions aren't jarring.
- **Demo blocks are often screen recordings**, not generated. We need a clean upload + trim UI for those.
- **Block taxonomy lock-in.** If we ship with `[Hook, Explanation, Demo, CTA]` hardcoded and users want `[Intro, Problem, Solution, Social Proof, CTA, Outro]`, we've painted ourselves in. Better to make slot types user-configurable per Template.
