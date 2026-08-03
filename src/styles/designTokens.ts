/**
 * A typed, JS-readable mirror of the numeric tokens already defined as CSS
 * custom properties in `src/app/globals.css`. Every value here is a
 * *duplicate*, not a new source of truth — `globals.css` remains
 * authoritative for anything a className string can express. This module
 * exists only for the handful of cases JS itself needs a token's numeric
 * value (e.g. a `matchMedia` breakpoint check, a `setTimeout` matched to a
 * CSS transition duration) — something no v1 component ever needed, which
 * is why this didn't exist before v2's Calendar/Command-Palette-style
 * components introduced the first real cases.
 *
 * If a value here and `globals.css` ever disagree, `globals.css` wins —
 * update this file to match, not the other way around.
 */

/** Mirrors Tailwind v4's default breakpoint scale — `globals.css` does not override it with `--breakpoint-*`, so these are Tailwind's own defaults, not a BloomOS-specific choice. Keep in sync if that ever changes. */
export const BREAKPOINTS_PX = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS_PX;

/** Mirrors `--duration-*-ms` in `globals.css`. */
export const DURATIONS_MS = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** Mirrors `--spacing-*-px` in `globals.css`. */
export const SPACING_PX = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
