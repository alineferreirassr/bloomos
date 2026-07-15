"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getExpenseById, updateExpense } from "@/lib/data";
import type { Expense } from "@/types/expense";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ExpenseForm } from "@/modules/finance/components/ExpenseForm";
import { expenseFormToInput } from "@/modules/finance/schema";
import { expenseToFormInput } from "@/modules/finance/mappers";
import { isExpenseTerminal } from "@/core/workflows/expenseWorkflow";
import { EXPENSE_STATUS_LABELS } from "@/core/enums/expenseStatus";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; expense: Expense };

/** updateExpense() (lib/data/index.ts) rejects a terminal (reimbursed/cancelled/archived) Expense outright — the whole form is replaced with a read-only notice accordingly, same precedent as EditInvoiceView/EditContractView. */
export function EditExpenseView({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getExpenseById(expenseId)
      .then((expense) => {
        if (!cancelled) setState({ status: "ready", expense });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This expense could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this expense." />;
  }

  const { expense } = state;

  if (isExpenseTerminal(expense.status)) {
    return (
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Edit Expense</h2>
        <p className="mt-4 text-sm text-text-muted">
          This expense is {EXPENSE_STATUS_LABELS[expense.status].toLowerCase()} and can&apos;t be edited.
        </p>
        <Link href={`/finance/expenses/${expenseId}`} className="mt-4 inline-block text-sm text-accent hover:underline">
          ← Back to expense
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-serif text-3xl font-semibold text-text">Edit Expense</h2>
      <div className="mt-6 max-w-3xl">
        <ExpenseForm
          submitLabel="Save changes"
          cancelHref={`/finance/expenses/${expenseId}`}
          defaultValues={expenseToFormInput(expense)}
          currentStatus={expense.status}
          onSubmit={async (input) => {
            const result = await updateExpense(expenseId, expenseFormToInput(input));
            if (result.success) {
              router.push(`/finance/expenses/${expenseId}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
