interface EventArchivedBannerProps {
  onRestore?: () => void;
  restorePending?: boolean;
  restoreDisabled?: boolean;
  restoreDisabledReason?: string;
}

/**
 * Persistent, not dismissible — same rationale as ServiceArchivedBanner.
 * `EventStatusBadge` alone doesn't read as distinctly "archived" from
 * "Cancelled" at a glance, so this banner is the one unambiguous signal.
 * No `onRestore` is passed from EventDetailView — EventActions already
 * renders a full-width Restore button directly below the header for an
 * archived Event, so wiring a second one here would duplicate that action
 * rather than surface a control that's otherwise hidden.
 */
export function EventArchivedBanner({ onRestore, restorePending = false, restoreDisabled = false, restoreDisabledReason }: EventArchivedBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-text/5 px-4 py-3">
      <p className="text-sm text-text">This Event is archived. It won&apos;t appear in the active Events list until restored.</p>
      {onRestore ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={restorePending || restoreDisabled}
          title={restoreDisabled ? restoreDisabledReason : undefined}
          className="shrink-0 rounded-md border border-accent px-3 py-1.5 font-serif text-[13px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/12 disabled:pointer-events-none disabled:opacity-45"
        >
          {restorePending ? "Restoring…" : "Restore"}
        </button>
      ) : null}
    </div>
  );
}
