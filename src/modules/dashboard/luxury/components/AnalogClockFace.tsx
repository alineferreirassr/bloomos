import type { ReactNode } from "react";

/**
 * The Amoré Bloom World Clock face — a gold-ringed, numeral analog clock
 * with a two-loop blush bow and heart details. AF → BloomOS Clock + Weather
 * Visual Parity Checkpoint — mechanically reconstructed from AF Digital
 * Studio OS's own `analogClockSvg` (src/lib/worldclock/clock-art.mjs):
 * full 1–12 numeral ring, 48 fine minute ticks, a blush (not neutral)
 * inner hairline, a larger center hub, and hands with a short counter-tail
 * past center — the density that reads as "decorative/premium" at a small
 * render size, which four bare tick marks never could. Every color still
 * comes from existing `--luxury-*` tokens (no hex copied from AF) — hands/
 * heart/numerals use Amoré's own wine, not AF's gold, per the Founder's
 * explicit "refined wine hands" brand-adaptation instruction.
 *
 * The hour/minute hands are real, computed rotations from the caller's
 * actual local hour/minute for that city — never a fixed decorative
 * position — so the illustration is honest, not just ornamental.
 */
function ClockNumerals() {
  const numerals: ReactNode[] = [];
  for (let h = 1; h <= 12; h++) {
    const a = (h * 30 * Math.PI) / 180;
    const x = 50 + Math.sin(a) * 31.5;
    const y = 50 - Math.cos(a) * 31.5 + 2.3;
    numerals.push(
      <text key={h} x={x} y={y} textAnchor="middle" fontFamily="var(--luxury-font-display)" fontSize="6.2" fill="var(--luxury-rose)" opacity="0.8">
        {h}
      </text>,
    );
  }
  return <>{numerals}</>;
}

function ClockMinuteTicks() {
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = (i * 6 * Math.PI) / 180;
    const x1 = 50 + Math.sin(a) * 38.2;
    const y1 = 50 - Math.cos(a) * 38.2;
    const x2 = 50 + Math.sin(a) * 39.6;
    const y2 = 50 - Math.cos(a) * 39.6;
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  return (
    <g stroke="var(--luxury-warning)" strokeWidth="0.5" opacity="0.5">
      {ticks}
    </g>
  );
}

function ClockHeart({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  return (
    <path
      transform={`translate(${cx} ${cy}) scale(${scale})`}
      d="M0 4c-4-3.5-7-6.4-7-9.4a3.6 3.6 0 0 1 7-1.2 3.6 3.6 0 0 1 7 1.2c0 3-3 5.9-7 9.4z"
      fill="var(--luxury-blush)"
      stroke="var(--luxury-rose)"
      strokeWidth="0.5"
    />
  );
}

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

      {/* Fine outer contour, then the dominant gold ring the face sits inside */}
      <circle cx="50" cy="50" r="47" fill="none" stroke="var(--luxury-warning)" strokeWidth="1.2" opacity="0.6" />
      <circle cx="50" cy="50" r="44" fill="url(#clockFaceBody)" stroke="var(--luxury-warning)" strokeWidth="3" />
      {/* Inner hairline — blush, not neutral, so it reads as a deliberate decorative ring rather than a structural line */}
      <circle cx="50" cy="50" r="41" fill="none" stroke="var(--luxury-blush)" strokeWidth="0.8" opacity="0.55" />

      <ClockMinuteTicks />
      <ClockNumerals />

      {/* Small heart accent, center-low on the face */}
      <ClockHeart cx={50} cy={60.5} scale={0.42} />

      {/* Hands — real, computed angles, never decorative-fixed. A short tail past center (AF's own hand
          anatomy) reads as a more considered, weighted hand than a stick pinned only at one end. */}
      <g strokeLinecap="round">
        <line x1="50" y1="53" x2="50" y2="29" stroke="var(--color-accent)" strokeWidth="2.6" transform={`rotate(${hourAngle} 50 50)`} />
        <line x1="50" y1="54" x2="50" y2="19" stroke="var(--luxury-rose)" strokeWidth="1.8" transform={`rotate(${minuteAngle} 50 50)`} />
      </g>
      <circle cx="50" cy="50" r="2.8" fill="var(--luxury-rose)" />
      <ClockHeart cx={50} cy={50} scale={0.32} />

      {/* Bow at 12 o'clock — two separate loops + a center knot, matching the reference's own anatomy
          rather than one fused path. */}
      <g transform="translate(50 9)">
        <path d="M0 -1C-3-4.5-8-4.5-8-1.2c0 3 4.5 3.6 8 1.7" fill="var(--luxury-blush)" stroke="var(--luxury-rose)" strokeWidth="0.6" />
        <path d="M0 -1C3-4.5 8-4.5 8-1.2c0 3-4.5 3.6-8 1.7" fill="var(--luxury-blush)" stroke="var(--luxury-rose)" strokeWidth="0.6" />
        <circle cx="0" cy="-1" r="1.9" fill="var(--luxury-blush)" stroke="var(--luxury-rose)" strokeWidth="0.6" />
      </g>
    </svg>
  );
}
