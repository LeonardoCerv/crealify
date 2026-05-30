# Current manual workflow (source of truth before automation)

This is what the user does today, step by step. Each step is a candidate for automation, and each step's automation has different costs/risks.

## 1. Character creation
- Tool: (TBD — Higgsfield? Midjourney? Other?)
- Output: A canonical reference of the AI character (face, look, identity).
- Constraint: **Visual consistency across many future videos** is critical.

## 2. Script generation
- Tool: ChatGPT or Claude (manual prompting today).
- Output: Full script, start to finish.
- Hook is the #1 quality lever — most attention goes here.
- Script structure roughly: hook → value/story → pitch for the user's platform.

## 3. Scene composition
- Place the character into a background/scene relevant to the script.
- Tool: Higgsfield (assumed).

## 4. Performance capture
- User films themselves acting out the script in real life.
- Why: drives motion/expression for step 6.

## 5. Voice replacement
- Source: user's recorded audio from step 4.
- Replace with an ElevenLabs synthetic voice.
- Open question: cloned voice of the user, or a new voice for the character?

## 6. Body replacement (motion control)
- Higgsfield motion-control feature.
- Replaces the user's body in the recorded footage with the AI character, driven by the user's motion.

## 7. Edit
- Combine all scenes.
- Add B-rolls.
- Add supplementary audio (music, SFX).
- Burn in captions.
- Open question: which editor — manual (CapCut/Premiere), API-driven (Shotstack/Creatomate/Remotion), or AI-driven?

## 8. Copy generation
- Generate post copy (caption, hashtags, CTA) per platform.
- Each platform has different conventions (TikTok ≠ IG ≠ FB).

## 9. Publish (one-click target)
- Facebook page post.
- Instagram Reel.
- TikTok video.
- Out of scope v1: ad campaign setup, targeting, budget.
