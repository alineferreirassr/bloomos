import type { WeatherCondition } from "@/types/weather";
import { WEATHER_CONDITION_LABEL } from "@/types/weather";

/**
 * Round 4.1 founder palette correction — "too dark, still not the soft pink
 * tone I want." The `--luxury-coral`/`--luxury-coral-foreground` tokens this
 * component originally read are misleadingly named: they actually resolve
 * to gold (`#bf9a52`, BloomOS's own `--color-accent-2`) and dark wine
 * (`#5c2530`) respectively — used correctly elsewhere (StudioTodayCard,
 * StudioTodaySection, OwnerHomeHeader all depend on those exact values), so
 * they are NOT touched here. This pin needed its own soft-blush palette
 * instead, defined locally so the shared `--luxury-*` design system and its
 * other consumers are unaffected — a palette refinement scoped to this one
 * component, not a token rewrite.
 */
const PIN_BLUSH = "#fbe4ea";
const PIN_ROSE = "#f2b9c9";
const GLYPH_STROKE = "#c9829a";
const HEART_PINK = "#e8869f";

interface WeatherPinProps {
  condition: WeatherCondition;
  /** Pixel size of the rendered square; the pin's own aspect ratio (5:6) is preserved inside it. Defaults to 40. */
  size?: number;
  className?: string;
}

/**
 * The Amoré Bloom Weather Pin — "Soft Editorial Pin" (Option B), the
 * Founder-approved direction from the Weather Visual Polish comparison
 * (three options shown, B selected). A location-pin silhouette with a
 * blush→soft-rose gradient body, a gold heart accent at its point, a
 * "glass" inset with a fine gold ring, gold-filled sun/moon glyphs, and
 * soft-rose line glyphs for every other condition (cloud, raindrops,
 * snowflakes, lightning, fog lines, wind swoosh). Same
 * hand-authored-inline-SVG pattern `BloomIllustration.tsx` established for
 * this codebase, rather than a generic weather-icon library.
 */
export function WeatherPin({ condition, size = 40, className = "" }: WeatherPinProps) {
  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={(size * 120) / 100}
      className={className}
      role="img"
      aria-label={WEATHER_CONDITION_LABEL[condition]}
    >
      <defs>
        <linearGradient id="weatherPinBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--luxury-warm-white)" />
          <stop offset="55%" stopColor={PIN_BLUSH} />
          <stop offset="100%" stopColor={PIN_ROSE} />
        </linearGradient>
        <radialGradient id="weatherPinGlass" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="var(--luxury-warm-white)" />
          <stop offset="100%" stopColor="var(--luxury-ivory)" />
        </radialGradient>
      </defs>

      {/* Pin silhouette: rounded head tapering to a point, soft-pink glossy fill + a thin GOLD outline
          ("gold-trimmed", per the founder's Round 4.1 correction — gold now behaves purely as a refined
          rim rather than a heavy wine contour). */}
      <path
        d="M50 6 C73 6 91 24 91 47 C91 68 62 100 52 116 C51 118 49 118 48 116 C38 100 9 68 9 47 C9 24 27 6 50 6 Z"
        fill="url(#weatherPinBody)"
        stroke="var(--luxury-warning)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Small heart accent near the pin's point — Round 4.2 founder correction: the reference art's heart
          reads as soft pink, not gold (gold is reserved for the rim/ring per §3's hierarchy), so this
          switched from `--luxury-warning` to the same soft-rose family as the pin body. */}
      <path
        d="M50 108 c-3.5-3.4-6-6.2-6-9 0-2 1.6-3.6 3.6-3.6 1 0 2 .5 2.4 1.3.4-.8 1.4-1.3 2.4-1.3 2 0 3.6 1.6 3.6 3.6 0 2.8-2.5 5.6-6 9z"
        fill={HEART_PINK}
        opacity="0.95"
      />

      {/* A double gold rim around the "glass" inset — AF's own pin anatomy pairs a fine outer contour with
          a slightly heavier inner ring, rather than a single hairline. */}
      <circle cx="50" cy="46" r="31.5" fill="none" stroke="var(--luxury-warning)" strokeWidth="0.6" opacity="0.5" />
      <circle cx="50" cy="46" r="29" fill="url(#weatherPinGlass)" stroke="var(--luxury-warning)" strokeWidth="1.2" opacity="0.95" />

      <g fill="none" stroke={GLYPH_STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <WeatherGlyph condition={condition} />
      </g>
    </svg>
  );
}

function Cloud({ y = 50 }: { y?: number }) {
  return (
    <g fill="var(--luxury-warm-white)">
      <ellipse cx="39" cy={y + 2} rx="8" ry="6.5" />
      <ellipse cx="50" cy={y - 3} rx="10.5" ry="9" />
      <ellipse cx="61" cy={y + 3} rx="7.5" ry="6" />
      <rect x="32" y={y} width="36" height="11" rx="5.5" />
    </g>
  );
}

function WeatherGlyph({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case "SUNNY":
      return (
        <>
          <circle cx="50" cy="46" r="10" fill="var(--luxury-warning)" stroke="none" />
          <path d="M50 26v6M50 60v6M30 46h6M64 46h6M36 32l4 4M60 56l4 4M64 32l-4 4M40 56l-4 4" />
        </>
      );
    case "NIGHT_CLEAR":
      return (
        <>
          <path d="M58 32a15 15 0 1 0 10 18 12 12 0 0 1-10-18z" fill="var(--luxury-warning)" stroke="none" />
          <path d="M35 34l1.6 3.4L40 39l-3.4 1.6L35 44l-1.6-3.4L30 39l3.4-1.6z" fill="var(--luxury-warning)" stroke="none" />
        </>
      );
    case "PARTLY_CLOUDY":
      return (
        <>
          <circle cx="62" cy="34" r="7" fill="var(--luxury-warning)" stroke="none" />
          <path d="M62 24v3M71 34h-3M53 27l2 2M69 27l-2 2" strokeWidth="1.8" />
          <Cloud y={50} />
        </>
      );
    case "CLOUDY":
      return <Cloud y={46} />;
    case "RAIN":
      return (
        <>
          <Cloud y={40} />
          <path d="M38 62l-3 7M50 62l-3 7M62 62l-3 7" strokeWidth="2.6" />
        </>
      );
    case "LIGHT_RAIN_DRIZZLE":
      return (
        <>
          <Cloud y={40} />
          <path d="M39 63l-1.5 4M50 63l-1.5 4M61 63l-1.5 4" strokeWidth="1.8" strokeDasharray="1 3" />
        </>
      );
    case "THUNDERSTORM":
      return (
        <>
          <Cloud y={38} />
          <path d="M52 58l-7 11h7l-4 9 11-13h-7z" fill="var(--luxury-warning)" stroke="none" />
        </>
      );
    case "SNOW":
      return (
        <>
          <Cloud y={40} />
          <g strokeWidth="1.8">
            <path d="M39 61v8M35 65h8M36.3 62.3l5.4 5.4M41.7 62.3l-5.4 5.4" />
            <path d="M61 61v8M57 65h8M58.3 62.3l5.4 5.4M63.7 62.3l-5.4 5.4" />
          </g>
        </>
      );
    case "FOG_MIST":
      return <path d="M28 38h44M24 46h52M28 54h44M32 62h36" strokeWidth="2.4" opacity="0.85" />;
    case "WINDY":
      return (
        <>
          <path d="M25 40h32a5 5 0 1 0-5-5" strokeWidth="2.4" />
          <path d="M25 50h40a5.5 5.5 0 1 1-5.5 5.5" strokeWidth="2.4" />
          <path d="M25 60h24a4 4 0 1 0-4-4" strokeWidth="2.4" />
        </>
      );
    default:
      return null;
  }
}
