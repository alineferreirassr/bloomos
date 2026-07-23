"use client";

import { useEffect, useState } from "react";
import { getAccountingPeriods } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ACCOUNTING_PERIOD_STATUS_LABELS, ACCOUNTING_PERIOD_STATUSES, type AccountingPeriodStatus } from "@/core/enums/accountingPeriodStatus";
import { FinanceLedgerNav } from "@/modules/finance/components/FinanceLedgerNav";
import { AccountingPeriodsTable } from "@/modules/finance/components/AccountingPeriodsTable";
import { CreateAccountingPeriodDialog } from "@/modules/finance/components/CreateAccountingPeriodDialog";
import { ClosePeriodDialog } from "@/modules/finance/components/ClosePeriodDialog";
import { LockPeriodDialog } from "@/modules/finance/components/LockPeriodDialog";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; periods: AccountingPeriod[] };

async function loadPeriods(status: AccountingPeriodStatus | "all"): Promise<LoadState> {
  try {
    const periods = await getAccountingPeriods({ status });
    return { status: "ready", periods };
  } catch {
    return { status: "error" };
  }
}

export function AccountingPeriodsView() {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const canUpdate = can("finance.update");
  const [statusFilter, setStatusFilter] = useState<AccountingPeriodStatus | "all">("all");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<AccountingPeriod | null>(null);
  const [lockTarget, setLockTarget] = useState<AccountingPeriod | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPeriods("all").then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = (next: AccountingPeriodStatus | "all") => {
    setStatusFilter(next);
    setState({ status: "loading" });
    loadPeriods(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadPeriods(statusFilter).then(setState);
  };

  const refresh = () => {
    loadPeriods(statusFilter).then(setState);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Accounting Periods</h2>
          <p className="mt-1 text-sm text-text-muted">
            Every posting is scoped to one open period. {getDataPersistenceMessage()}
          </p>
        </div>
        {canCreate ? <Button onClick={() => setCreateOpen(true)}>Create Period</Button> : null}
      </div>

      <div className="mt-6">
        <FinanceLedgerNav />
      </div>

      <div className="mt-6 max-w-xs">
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(event) => handleStatusChange(event.target.value as AccountingPeriodStatus | "all")}
        >
          <option value="all">All statuses</option>
          {ACCOUNTING_PERIOD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ACCOUNTING_PERIOD_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load Accounting Periods." onRetry={retry} />
        ) : state.periods.length === 0 ? (
          <EmptyState
            title={statusFilter === "all" ? "No accounting periods yet" : "No periods match this status"}
            action={
              statusFilter === "all" && canCreate ? (
                <Button onClick={() => setCreateOpen(true)}>Create Period</Button>
              ) : undefined
            }
          />
        ) : (
          <AccountingPeriodsTable
            periods={state.periods}
            canUpdate={canUpdate}
            onClose={setCloseTarget}
            onLock={setLockTarget}
          />
        )}
      </div>

      <CreateAccountingPeriodDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      {closeTarget ? (
        <ClosePeriodDialog
          open={!!closeTarget}
          onClose={() => setCloseTarget(null)}
          period={closeTarget}
          onClosed={refresh}
        />
      ) : null}
      {lockTarget ? (
        <LockPeriodDialog open={!!lockTarget} onClose={() => setLockTarget(null)} period={lockTarget} onLocked={refresh} />
      ) : null}
    </div>
  );
}
