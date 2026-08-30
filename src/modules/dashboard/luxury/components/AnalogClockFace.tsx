/**
 * The Amoré Bloom World Clock face — a gold-ringed analog clock with a
 * small bow at 12 and a heart accent near the center, matching the
 * Founder-approved World Clock reference sheet. Hand-authored inline SVG,
 * the same pattern `WeatherPin.tsx` already established for this codebase
 * (no icon library has anything like this, and a decorative illustration
 * this specific doesn't warrant a new dependency) — every color comes from
 * existing `--luxury-*`/`--color-accent-*` tokens, no new palette.
 *
 * The hour/minute hands are real, computed rotations from the caller's
 * actual local hour/minute for that city — never a fixed decorative
 * position — so the illustration is honest, not just ornamental.
 */
export function AnalogClockFace({ hour24, minute, size = 48, className = "" }: { hour24: number; minute: number; size?: number; className?: string }) {
  const minuteAngle = (minute / 60) * 360;
  const hourAngle = ((hour24 % 12) / 12) * 360 + (minute / 60) * 30;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="clockFaceBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--luxury-warm-white)" />
          <stop offset="100%" stopColor="var(--luxury-ivory)" />
        </linearGradient>
      </defs>

      {/* Gold outer ring — thinner, Final Clock + Weather Visual Refinement, for a more delicate/editorial face */}
      <circle cx="50" cy="50" r="38" fill="url(#clockFaceBody)" stroke="var(--luxury-warning)" strokeWidth="2" />
      {/* Inner hairline ring, pulled in slightly for more negative space between the two rings */}
      <circle cx="50" cy="50" r="32" fill="none" stroke="var(--luxury-border)" strokeWidth="0.75" />

      {/* Hour ticks at 12/3/6/9 only — restrained, not a full 12-tick face */}
      <g stroke="var(--luxury-beige)" strokeWidth="1" strokeLinecap="round">
        <line x1="50" y1="16" x2="50" y2="19" />
        <line x1="84" y1="50" x2="81" y2="50" />
        <line x1="50" y1="84" x2="50" y2="81" />
        <line x1="16" y1="50" x2="19" y2="50" />
      </g>

      {/* Small heart accent, center-low on the face — brand vocabulary, matches WeatherPin's own heart-accent precedent */}
      <path
        d="M50 61.5c-2.2-2.1-3.8-3.9-3.8-5.7 0-1.3 1-2.3 2.3-2.3.7 0 1.3.3 1.5.8.2-.5.8-.8 1.5-.8 1.3 0 2.3 1 2.3 2.3 0 1.8-1.6 3.6-3.8 5.7z"
        fill="var(--luxury-rose)"
        opacity="0.85"
      />

      {/* Hands — real, computed angles, never decorative-fixed; thinner for a lighter, more editorial feel */}
      <g strokeLinecap="round">
        <line x1="50" y1="50" x2="50" y2="30" stroke="var(--color-accent)" strokeWidth="2.2" transform={`rotate(${hourAngle} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="22" stroke="var(--luxury-rose)" strokeWidth="1.4" transform={`rotate(${minuteAngle} 50 50)`} />
      </g>
      <circle cx="50" cy="50" r="1.8" fill="var(--luxury-rose)" />

      {/* Bow at 12 o'clock — two loops + a small knot, scaled down further for a subtler accent */}
      <g transform="translate(50 12) scale(0.82)">
        <path d="M0 0c-5-4-11-2-11 2s6 4 11 1c5 3 11 3 11-1s-6-6-11-2z" fill="var(--luxury-blush)" stroke="var(--luxury-rose)" strokeWidth="0.85" />
        <circle cx="0" cy="0.5" r="1.4" fill="var(--luxury-warning)" />
      </g>
    </svg>
  );
}
