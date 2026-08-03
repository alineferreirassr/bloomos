"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJournalEntry, getAccountingPeriod } from "@/lib/data";
import type { JournalEntry } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { PostingStatusBadge } from "@/modules/finance/components/PostingStatusBadge";
import { JournalLinesTable } from "@/modules/finance/components/JournalLinesTable";
import { ReverseJournalEntryDialog } from "@/modules/finance/components/ReverseJournalEntryDialog";
import { formatEventDate } from "@/modules/events/dateFormat";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entry: JournalEntry; period: AccountingPeriod | null };

async function loadEntry(id: string): Promise<LoadState> {
  try {
    const entry = await getJournalEntry(id);
    const period = await getAccountingPeriod(entry.accounting_period_id).catch(() => null);
    return { status: "ready", entry, period };
  } catch {
    return { status: "error" };
  }
}

export function JournalEntryDetailView({ journalEntryId }: { journalEntryId: string }) {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadEntry(journalEntryId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [journalEntryId]);

  const retry = () => {
    setState({ status: "loading" });
    loadEntry(journalEntryId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this Journal Entry." onRetry={retry} />;
  }

  const { entry, period } = state;
  // Reversal is only offered for an unreversed entry — reversing a reversal
  // itself, or an already-reversed entry, is rejected by reverse_journal_entry
  // (P1109) anyway, but hiding the action here avoids an avoidable failed
  // attempt for the common case.
  const canReverse = canCreate && !entry.reversed_by_entry_id;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Journal Entry</h2>
          <p className="mt-1 font-mono text-xs text-text-muted">{entry.id}</p>
        </div>
        {canReverse ? <Button onClick={() => setReverseDialogOpen(true)}>Reverse Entry</Button> : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 rounded-md border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs text-text-muted uppercase">Entry Date</p>
          <p className="mt-0.5 text-sm text-text">{formatEventDate(entry.entry_date)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase">Posting Status</p>
          <div className="mt-0.5">
            <PostingStatusBadge status={entry.posting_status} />
          </div>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase">Accounting Period</p>
          <p className="mt-0.5 text-sm text-text">
            {period ? `${formatEventDate(period.period_start)} – ${formatEventDate(period.period_end)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase">Source Type</p>
          <p className="mt-0.5 text-sm text-text">{entry.source_type}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase">Source ID</p>
          <p className="mt-0.5 font-mono text-xs text-text">{entry.source_id ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase">Posting Key</p>
          <p className="mt-0.5 font-mono text-xs text-text">{entry.posting_key ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase">Posted By</p>
          <p className="mt-0.5 text-sm text-text">{entry.posted_by}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase">Created</p>
          <p className="mt-0.5 text-sm text-text">{formatEventDate(entry.created_at)}</p>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="text-xs text-text-muted uppercase">Memo</p>
          <p className="mt-0.5 text-sm text-text">{entry.memo ?? "—"}</p>
        </div>
      </div>

      {entry.reverses_entry_id || entry.reversed_by_entry_id ? (
        <div className="mt-4 rounded-md border border-border bg-text/4 p-3 text-sm text-text-muted">
          {entry.reverses_entry_id ? (
            <p>
              This entry reverses{" "}
              <Link href={`/finance/journal/${entry.reverses_entry_id}`} className="text-accent hover:underline">
                {entry.reverses_entry_id.slice(0, 8)}
              </Link>
              .
            </p>
          ) : null}
          {entry.reversed_by_entry_id ? (
            <p>
              This entry was reversed by{" "}
              <Link href={`/finance/journal/${entry.reversed_by_entry_id}`} className="text-accent hover:underline">
                {entry.reversed_by_entry_id.slice(0, 8)}
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-text">Journal Lines</h3>
        <p className="mt-1 text-xs text-text-muted">Read-only — a Journal Entry is never edited directly.</p>
        <div className="mt-3">
          <JournalLinesTable lines={entry.lines ?? []} currency={entry.currency} />
        </div>
      </div>

      <ReverseJournalEntryDialog
        open={reverseDialogOpen}
        onClose={() => setReverseDialogOpen(false)}
        journalEntryId={entry.id}
        onReversed={() => {
          setState({ status: "loading" });
          loadEntry(journalEntryId).then(setState);
        }}
      />
    </div>
  );
}
