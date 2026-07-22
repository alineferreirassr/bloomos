/** Read-only preferred indicator for the list column — same minimal-glyph convention as ActionMenu's "⋯". */
export function PreferredStar({ isPreferred }: { isPreferred: boolean }) {
  return (
    <span
      aria-label={isPreferred ? "Preferred vendor" : "Not a preferred vendor"}
      title={isPreferred ? "Preferred vendor" : undefined}
      className={isPreferred ? "text-accent" : "text-text/25"}
    >
      {isPreferred ? "★" : "☆"}
    </span>
  );
}
