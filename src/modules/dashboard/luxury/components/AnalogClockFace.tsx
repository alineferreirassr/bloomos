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

      {/* Gold outer ring */}
      <circle cx="50" cy="50" r="38" fill="url(#clockFaceBody)" stroke="var(--luxury-warning)" strokeWidth="3" />
      {/* Inner hairline ring, restrained */}
      <circle cx="50" cy="50" r="33" fill="none" stroke="var(--luxury-border)" strokeWidth="1" />

      {/* Hour ticks at 12/3/6/9 only — restrained, not a full 12-tick face */}
      <g stroke="var(--luxury-beige)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="50" y1="15" x2="50" y2="19" />
        <line x1="85" y1="50" x2="81" y2="50" />
        <line x1="50" y1="85" x2="50" y2="81" />
        <line x1="15" y1="50" x2="19" y2="50" />
      </g>

      {/* Small heart accent, center-low on the face — brand vocabulary, matches WeatherPin's own heart-accent precedent */}
      <path
        d="M50 63c-2.6-2.5-4.5-4.6-4.5-6.7 0-1.5 1.2-2.7 2.7-2.7.8 0 1.5.4 1.8 1 .3-.6 1-1 1.8-1 1.5 0 2.7 1.2 2.7 2.7 0 2.1-1.9 4.2-4.5 6.7z"
        fill="var(--luxury-rose)"
        opacity="0.85"
      />

      {/* Hands — real, computed angles, never decorative-fixed */}
      <g strokeLinecap="round">
        <line x1="50" y1="50" x2="50" y2="30" stroke="var(--color-accent)" strokeWidth="3" transform={`rotate(${hourAngle} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="22" stroke="var(--luxury-rose)" strokeWidth="2" transform={`rotate(${minuteAngle} 50 50)`} />
      </g>
      <circle cx="50" cy="50" r="2.5" fill="var(--luxury-rose)" />

      {/* Bow at 12 o'clock — two loops + a small knot, restrained scale */}
      <g transform="translate(50 12)">
        <path d="M0 0c-5-4-11-2-11 2s6 4 11 1c5 3 11 3 11-1s-6-6-11-2z" fill="var(--luxury-blush)" stroke="var(--luxury-rose)" strokeWidth="1" />
        <circle cx="0" cy="0.5" r="1.6" fill="var(--luxury-warning)" />
      </g>
    </svg>
  );
}
