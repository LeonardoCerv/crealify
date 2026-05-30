# Open questions

Tracks unresolved decisions. Each gets moved to `decisions.md` once locked.

## Strategic
- [ ] Final project name.
- [ ] Automation depth — full autonomous agent vs. Claude Code orchestrating user-in-the-loop steps.
- [ ] Scope of v1 vs. later phases.

## Technical stack
- [ ] Primary language (Python / Node / TypeScript).
- [ ] Runtime form factor (CLI, local web UI, hosted service, pure Claude Code skills).
- [ ] Where state/assets live (local FS, S3, Supabase, etc.).

## Integrations & access
- [ ] Higgsfield MCP — does it exist, what does it expose, do we have access?
- [ ] Higgsfield API access beyond the MCP?
- [ ] ElevenLabs API key in hand?
- [ ] Meta Business / Graph API app and tokens?
- [ ] TikTok Content Posting API access (gated, requires approval).
- [ ] Which Meta page(s) and IG business account(s)?

## Character
- [ ] How is character consistency enforced across videos? (seed/reference image, character LoRA, Higgsfield character feature)
- [ ] One character or a roster?

## Editing pipeline
- [ ] Manual final edit vs. programmatic (Remotion / Shotstack / Creatomate / ffmpeg).
- [ ] B-roll source (stock API, generated, manually picked).
- [ ] Captions engine (Whisper-timestamped, ElevenLabs aligned, manual).

## Voice
- [ ] Cloned voice of the user, or new persona voice for the AI character?
- [ ] Language(s) — Spanish, English, both?

## Publishing
- [ ] Single account or multi-account / per-product?
- [ ] Scheduling required (post now vs. queue for a time)?
- [ ] Approval gate before posting, or fully automatic?
