interface ServiceArchivedBannerProps {
  onRestore?: () => void;
  restorePending?: boolean;
  restoreDisabled?: boolean;
  restoreDisabledReason?: string;
}

/** Persistent, not dismissible — an archived Service stays read-only for the whole session, so there's nothing to "acknowledge and hide." Restore is rendered here directly (not just in the header's ActionMenu) since it's the one action every archived screen should make impossible to miss. */
export function ServiceArchivedBanner({ onRestore, restorePending = false, restoreDisabled = false, restoreDisabledReason }: ServiceArchivedBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-text/5 px-4 py-3">
      <p className="text-sm text-text">
        This Service is archived. Identity and draft version fields are read-only until it&apos;s restored.
      </p>
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
