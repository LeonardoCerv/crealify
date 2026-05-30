# Crealify brand assets

Drop the official vector exports here when you produce them.

## Expected files

| File | Purpose |
|---|---|
| `wordmark.svg` | The full "crealify" wordmark with the play-marked `a`. Used in the landing hero and the app header. |
| `mark.svg` | The standalone "a-with-play" isotype. Used as the favicon, in compact UI, and as a watermark in renders. |
| `wordmark@2x.png` | 2× PNG fallback of the wordmark for places SVG can't go (Open Graph cards, email). |
| `mark@2x.png` | 2× PNG fallback of the mark. |
| `og-card.png` | Optional 1200×630 Open Graph share image. |

## How they're used

- `apps/web/src/components/brand/logo.tsx` currently renders **inline SVG approximations** so the app has a brand from day one. Once these files exist, swap the SVG paths in that component to reference `/brand/wordmark.svg` and `/brand/mark.svg` (e.g. via `<Image>` or `<img>` tags), or paste the official SVG contents directly into the components.
- `apps/web/src/app/icon.svg` is the favicon (Next.js convention). Replace it with the official `mark.svg` once you have it.

## Palette (sampled from the wordmark)

| Token | Hex | Where used |
|---|---|---|
| `ink` | `#2a3137` | All foreground text, mark fill |
| `paper` | `#f1ebde` | App background, counter punch-out in the mark |
| `sparkle` | `#c2a36c` | Accent for decorative sparkles |

These are wired into `apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css`.
