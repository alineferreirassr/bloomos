"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents, getExpenseNextAction, getExpenses } from "@/lib/data";
import type { Expense } from "@/types/expense";
import type { Event } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  ExpenseFilters,
  DEFAULT_EXPENSE_FILTERS,
  type ExpenseFiltersValue,
} from "@/modules/finance/components/ExpenseFilters";
import { ExpenseListTable } from "@/modules/finance/components/ExpenseListTable";
import { ExpenseListCards } from "@/modules/finance/components/ExpenseListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

export interface ExpenseListRow {
  expense: Expense;
  event: Event | undefined;
  nextAction: string | null;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: ExpenseListRow[] };

async function loadExpensesFor(filters: ExpenseFiltersValue): Promise<LoadState> {
  try {
    const [expenses, events] = await Promise.all([
      getExpenses({
        search: filters.search,
        status: filters.status,
        category: filters.category,
        dueOnly: filters.dueOnly,
        unpaidOnly: filters.unpaidOnly,
        reimbursableOnly: filters.reimbursableOnly,
        includeArchived: filters.includeArchived,
      }),
      getEvents({ includeArchived: true }),
    ]);
    const eventsById = new Map(events.map((event) => [event.id, event]));

    const sorted = [...expenses].sort(
      (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
    );

    const rows = await Promise.all(
      sorted.map(async (expense) => {
        const nextAction = await getExpenseNextAction(expense.id);
        return {
          expense,
          event: expense.event_id ? eventsById.get(expense.event_id) : undefined,
          nextAction,
        };
      }),
    );

    return { status: "ready", rows };
  } catch {
    return { status: "error" };
  }
}

export function ExpensesListView() {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const [filters, setFilters] = useState<ExpenseFiltersValue>(DEFAULT_EXPENSE_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadExpensesFor(DEFAULT_EXPENSE_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: ExpenseFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadExpensesFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadExpensesFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.dueOnly ||
    filters.unpaidOnly ||
    filters.reimbursableOnly;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Expenses</h2>
          <p className="mt-1 text-sm text-text-muted">
            Every cost the business incurs — Event-specific, general business, or supplier/team-related.
            Data resets on page reload — there&apos;s no database behind this yet.
          </p>
        </div>
        {canCreate ? (
          <Link href="/finance/expenses/new">
            <Button>New Expense</Button>
          </Link>
        ) : null}
      </div>

      <div className="mt-6">
        <ExpenseFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load expenses." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No expenses match these filters" : "No expenses yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New expenses you create will show up here."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/finance/expenses/new">
                  <Button>New Expense</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ExpenseListTable rows={state.rows} />
            <ExpenseListCards rows={state.rows} />
          </>
        )}
      </div>
    </div>
  );
}
