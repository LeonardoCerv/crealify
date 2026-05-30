/**
 * Crealify brand marks — inline SVG / styled text so they are crisp at any
 * size, never require a network round-trip, and inherit `currentColor`.
 *
 * NOTE: these are approximations of the official brand assets. When you
 * export the real SVGs from the design source, drop them into
 * `apps/web/public/brand/` (see public/brand/README.md) and update these
 * components to reference the exported paths.
 */

type Size = "sm" | "md" | "lg";

const markPx: Record<Size, number> = { sm: 22, md: 32, lg: 64 };
const wordFontPx: Record<Size, number> = { sm: 18, md: 26, lg: 56 };

/**
 * The "a-with-play" isotype. Stylized lowercase `a` with a play triangle
 * inside the counter. Renders in `currentColor`.
 *
 * `--paper` CSS variable is used to "punch out" the counter; defaults to
 * the brand cream when the variable isn't set.
 */
export function CrealifyMark({
  size = "md",
  title = "Crealify",
}: {
  size?: Size;
  title?: string;
}) {
  const px = markPx[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* Two-story lowercase `a`: outer bowl + stem on the right. */}
      <path
        d="M44 8h6v48h-6v-6c-3 4-8 7-14 7C13 57 4 47 4 34s9-23 26-23c5 0 11 2 14 5V8zM26 49c10 0 18-7 18-15s-8-15-18-15S8 26 8 34s8 15 18 15z"
        fill="currentColor"
      />
      {/* Counter — filled with paper colour to "punch" a hole inside the bowl. */}
      <circle cx="26" cy="34" r="11" fill="var(--paper, #fafbfc)" />
      {/* Play triangle */}
      <polygon points="22,28 22,40 33,34" fill="currentColor" />
    </svg>
  );
}

/**
 * The full Crealify wordmark. Plain styled text so it inherits whatever
 * geometric system font is available. Swap with the official SVG when
 * you've exported it from your design source.
 */
export function CrealifyWordmark({
  size = "md",
  title = "Crealify",
}: {
  size?: Size;
  title?: string;
}) {
  const fontPx = wordFontPx[size];
  return (
    <span
      className="inline-block font-sans font-extrabold leading-none tracking-[-0.045em]"
      style={{ fontSize: fontPx }}
      aria-label={title}
      role="img"
    >
      crealify
    </span>
  );
}

/**
 * Wordmark + mark pair — used on the landing hero where we want both visible.
 */
export function CrealifyLockup({ size = "md" }: { size?: Size }) {
  return (
    <span className="inline-flex items-center gap-3">
      <CrealifyMark size={size} title="" />
      <CrealifyWordmark size={size} />
    </span>
  );
}

/**
 * Decorative four-point sparkle used as a small accent. Pure decoration —
 * never substitutes for the mark.
 */
export function CrealifySparkle({
  size = 12,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z" fill="currentColor" />
    </svg>
  );
}
