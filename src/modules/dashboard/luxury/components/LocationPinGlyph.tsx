/** A small wine-toned location-pin glyph next to a city name in a Weather card header — same restrained inline-SVG convention as `AnalogClockFace`/`WeatherPin`, not an icon-library import for one micro-illustration. */
export function LocationPinGlyph() {
  return (
    <svg viewBox="0 0 20 24" width="10" height="12" aria-hidden="true" className="shrink-0">
      <path
        d="M10 1c5 0 8.5 3.8 8.5 8.4 0 4.6-6 11.7-8 13.9-.3.3-.7.3-1 0-2-2.2-8-9.3-8-13.9C1.5 4.8 5 1 10 1z"
        fill="none"
        stroke="var(--luxury-rose)"
        strokeWidth="1.6"
      />
      <circle cx="10" cy="9.4" r="2.8" fill="var(--luxury-rose)" />
    </svg>
  );
}
