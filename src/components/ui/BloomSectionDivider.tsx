interface BloomSectionDividerProps {
  /** Optional label centered on the divider line (e.g. "Earlier this month"). Omit for a plain rule. */
  label?: string;
  className?: string;
}

/**
 * Checkpoint 19.3, Step 2 — a soft, editorial section break for long pages
 * (a detail view with several stacked sections, a long timeline) instead of
 * a bare `<hr>` or a plain `border-t`. When a label is given, the rule
 * breaks around it rather than running underneath — the same "quiet
 * structure" idiom `SectionHeader`/`PageHeader` already use elsewhere.
 */
export function BloomSectionDivider({ label, className = "" }: BloomSectionDividerProps) {
  if (!label) {
    return <hr className={`border-t border-border ${className}`} />;
  }

  return (
    <div role="separator" className={`flex items-center gap-3 ${className}`}>
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-xs font-medium tracking-wide text-text-muted uppercase">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
