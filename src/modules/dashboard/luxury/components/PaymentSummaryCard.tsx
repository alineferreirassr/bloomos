import { StatusBadge, type StatusBadgeTone } from "@/modules/dashboard/luxury/components/StatusBadge";

export interface PaymentSummaryRowData {
  label: string;
  amountLabel: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  helper?: string | null;
}

/** Checkpoint 19, Step 9 — the Client Dashboard's "Payments" card: Total / Deposit Paid / Final Payment rows, each with a real formatted amount and a real status pill — matches the approved Client reference image exactly. */
export function PaymentSummaryCard({ totalLabel, rows }: { totalLabel: string; rows: PaymentSummaryRowData[] }) {
  return (
    <div>
      <p className="text-luxury-small text-luxury-text-muted">Total</p>
      <p className="font-luxury-display text-luxury-display font-semibold text-luxury-text">{totalLabel}</p>
      <ul className="mt-4 space-y-3 border-t border-luxury-border pt-4">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-luxury-body font-medium text-luxury-text">{row.label}</span>
              {row.helper ? <span className="block text-luxury-small text-luxury-text-muted">{row.helper}</span> : null}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-luxury-body font-semibold text-luxury-text">{row.amountLabel}</span>
              <StatusBadge label={row.statusLabel} tone={row.statusTone} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
