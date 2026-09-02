import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { PostingStatusBadge } from "@/modules/finance/components/PostingStatusBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { JournalEntry } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";

interface JournalEntriesTableProps {
  entries: JournalEntry[];
  periodsById: Map<string, AccountingPeriod>;
}

/**
 * No Total Debit/Total Credit column here — listJournalEntries returns
 * entries without their lines (see JournalEntry's own doc comment), and
 * fetching lines per row to sum them would be exactly the N+1 pattern this
 * phase must avoid. Totals are shown on the Journal Entry detail page,
 * where getJournalEntry legitimately fetches lines already. Reference uses
 * the entry's own id (no separate "entry number" field exists on the
 * domain object).
 */
export function JournalEntriesTable({ entries, periodsById }: JournalEntriesTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/70">
              {["Date", "Reference", "Memo", "Source Type", "Period", "Status", "Reversal"].map((heading) => (
                <th
                  key={heading}
                  className="px-5 py-4 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {entries.map((entry) => {
              const period = periodsById.get(entry.accounting_period_id);
              return (
                <tr key={entry.id} className="hover:bg-text/4">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <Link href={`/finance/journal/${entry.id}`} className="font-medium text-text hover:text-accent">
                      {formatEventDate(entry.entry_date)}
                    </Link>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs whitespace-nowrap text-text-muted">
                    {entry.id.slice(0, 8)}
                  </td>
                  <td className="px-5 py-4 text-text-muted">{entry.memo ?? "—"}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                    {entry.source_type}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                    {period ? `${formatEventDate(period.period_start)} – ${formatEventDate(period.period_end)}` : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <PostingStatusBadge status={entry.posting_status} />
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {entry.reversed_by_entry_id ? (
                      <Badge tone="neutral">Reversed</Badge>
                    ) : entry.reverses_entry_id ? (
                      <Badge tone="outline">Reversal</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {entries.map((entry) => {
          const period = periodsById.get(entry.accounting_period_id);
          return (
            <Link key={entry.id} href={`/finance/journal/${entry.id}`} className="block">
              <LuxuryCard className="transition-colors duration-150 hover:border-accent/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium tracking-tight text-text">{formatEventDate(entry.entry_date)}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{entry.memo ?? entry.source_type}</p>
                    {period ? (
                      <p className="mt-0.5 text-xs text-text-muted">
                        {formatEventDate(period.period_start)} – {formatEventDate(period.period_end)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <PostingStatusBadge status={entry.posting_status} />
                    {entry.reversed_by_entry_id ? <Badge tone="neutral">Reversed</Badge> : null}
                    {entry.reverses_entry_id ? <Badge tone="outline">Reversal</Badge> : null}
                  </div>
                </div>
              </LuxuryCard>
            </Link>
          );
        })}
      </div>
    </>
  );
}
