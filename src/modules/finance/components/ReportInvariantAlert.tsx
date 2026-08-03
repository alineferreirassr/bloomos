interface ReportInvariantAlertProps {
  isBalanced: boolean;
  /** e.g. "Total debits equal total credits." */
  balancedMessage: string;
  /** e.g. "Total debits do not equal total credits. Do not rely on these figures until this is investigated." */
  unbalancedMessage: string;
}

/**
 * Displays the Repository's own isBalanced flag exactly as returned — never
 * recomputed here (a UI component is never an independent accounting
 * engine), never hidden, never silently corrected. A balanced result is a
 * subtle, low-emphasis confirmation; an unbalanced one is a prominent,
 * alert-semantic warning — the report's own numbers are still shown
 * unchanged either way, with no plug value ever inserted.
 */
export function ReportInvariantAlert({ isBalanced, balancedMessage, unbalancedMessage }: ReportInvariantAlertProps) {
  if (isBalanced) {
    return (
      <div className="rounded-md border border-border bg-text/4 px-3 py-2 text-xs text-text-muted">
        Balanced — {balancedMessage}
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger">
      Not balanced — {unbalancedMessage}
    </div>
  );
}
