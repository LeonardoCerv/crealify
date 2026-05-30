# Higgsfield capability map (researched 2026-05-29)

What Higgsfield exposes via its MCP / CLI / API, and how each maps onto our workflow.

## Access surfaces
- **MCP** — `claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp`. Authenticates via Higgsfield account, no API keys per request. Convenient but reportedly more tokens.
- **CLI** — `higgsfield` CLI with `auth`, `model`, `generate`, `upload`, `soul-id`, `marketing-studio` command groups. Cheaper for agentic workflows.
- **Direct HTTP API** — Higgsfield Cloud API + third-party (WaveSpeedAI etc.) for raw model calls.

For a deployed web app we'll likely use the **HTTP API** (Cloud API) directly rather than MCP — MCP is for in-agent use, not for our server calling Higgsfield on behalf of a user.

## Tools exposed (via MCP)
1. **Video Analyzer** — extract style/elements from a reference video.
2. **Marketing Video Generator** — polished promo videos from a product URL.
3. **Soul Character Training** — train a persistent character from reference photos.
4. **Cinematic Image-to-Video** — animate stills with motion presets (DoP).
5. **Viral Clip Generator** — reformat long-form into vertical clips with typography.
6. **Virality Prediction** — score hook strength & retention.
7. **General Image & Video Generation** — across 30+ models.

## Underlying model families
Soul 2.0, Kling 3.0, Seedance 2.0, Nano Banana Pro, GPT Image 2, Seedream 4.5, Veo 3.1, Cinema Studio 3.0, Minimax Hailuo, etc.

## Capability → workflow-step mapping

| Workflow step | Higgsfield feature that covers it | Status |
|---|---|---|
| Character creation | **Soul ID** (train from ~20 photos) | ✅ fully covered |
| Visual consistency across videos | **Soul ID** + character_id reference | ✅ fully covered |
| Scene/background composition | **Soul 2.0 image gen** (4K, 20+ presets) | ✅ fully covered |
| Image → motion (camera, environment) | **DoP** (5s cinematic clips) | ✅ fully covered |
| Body replacement / character animation | **Motion Control** (precise char animation) | ✅ fully covered |
| Talking head / lip sync | **Lipsync Studio** — lipsync-2 (v2v), Speak v2, Kling Avatar, InfiniteTalk, Veo 3 | ✅ fully covered |
| Voice synthesis | **Higgsfield Audio** — Voiceover, Voice Swap, Translate | ✅ covered — **could replace ElevenLabs** |
| Hook quality scoring | **Virality Prediction** | ✅ bonus |
| Long-form → vertical clip + captions | **Viral Clip Generator** | ✅ partial editing |
| Multi-scene assembly + B-rolls | (not provided) | ❌ we build |
| Cross-platform publishing | (not provided) | ❌ we build |
| Script generation | (not provided) | ❌ we build with Anthropic/OpenAI |

## Implications
- **Higgsfield handles ~70% of the pipeline.** Our app is mostly: project state + script gen + Higgsfield orchestration + final assembly + publishing.
- **ElevenLabs becomes optional.** Higgsfield Audio + Lipsync Studio together can do voice + sync. Worth keeping ElevenLabs as a swappable backend for premium voice quality if the user prefers it.
- The **performance-capture step in the manual workflow may not be needed anymore** — Higgsfield Kling Avatar / lipsync-2 can drive a talking-head video from a portrait + audio. The user only needs to film themselves if they want their own body motion / gestures.
- **Soul ID is the answer** to character consistency. Train once, reference forever.

## Open Higgsfield questions
- Exact pricing per generation (the credit system).
- Lipsync model quality difference between Kling Avatar, InfiniteTalk, Veo 3 — pick a default.
- DoP video length max (advertised 5s; some workflows need longer — stitch multiple).
- Rate limits / concurrency for the Cloud API.

## Sources
- https://higgsfield.ai/mcp
- https://higgsfield.ai/cli
- https://higgsfield.ai/blog/SOUL-ID-Superior-Level-of-AI-Character-Consistency
- https://higgsfield.ai/blog/Generate-AI-Videos-From-Claude-with-Higgsfield-MCP
- https://higgsfield.ai/lipsync-studio
- https://higgsfield.ai/blog/higgsfield-audio-ai-voice-tools
- https://higgsfield.ai/ai/video/motion
- https://cloud.higgsfield.ai/
