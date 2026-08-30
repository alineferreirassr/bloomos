/** A small hand-authored sun/moon glyph beside a day-period label ("Evening", "Night", ...) — same restrained inline-SVG convention as `AnalogClockFace`/`WeatherPin`, shared by `WorldClockCard` and `CompactClockWeatherPanel` rather than duplicated. */
export function DayPeriodGlyph({ isNight }: { isNight: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="11" height="11" aria-hidden="true" className="shrink-0">
      {isNight ? (
        <path d="M13 4a6.5 6.5 0 1 0 4.3 8.6A5.2 5.2 0 0 1 13 4z" fill="var(--luxury-warning)" />
      ) : (
        <>
          <circle cx="10" cy="10" r="3.6" fill="var(--luxury-warning)" />
          <path d="M10 2.4v2M10 15.6v2M17.6 10h-2M4.4 10h-2M15.4 4.6l-1.4 1.4M6 14l-1.4 1.4M15.4 15.4l-1.4-1.4M6 6 4.6 4.6" stroke="var(--luxury-warning)" strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
