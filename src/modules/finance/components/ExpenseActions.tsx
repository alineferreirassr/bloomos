"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  approveExpense,
  archiveExpense,
  cancelExpense,
  duplicateExpense,
  recordExpenseTransition,
  restoreExpense,
} from "@/lib/data";
import type { Expense } from "@/types/expense";
import { canTransitionExpenseStatus, isExpenseTerminal } from "@/core/workflows/expenseWorkflow";
import { ConfirmExpenseActionModal } from "@/modules/finance/components/ConfirmExpenseActionModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface ExpenseActionsProps {
  expense: Expense;
  onChanged: () => void;
}

type ModalKind = "cancel" | "archive" | null;

/**
 * Due/Paid/Reimbursed post through the ledger via recordExpenseTransition
 * (Posting Engine), while Approve/Cancel/Archive/Restore/Duplicate stay on
 * their pre-existing dedicated data-layer actions — those five don't post
 * a journal entry. Confirmation modals gate only Cancel/Archive
 * (terminal-or-destructive); Approve/Mark Due/Mark Paid/Mark Reimbursed are
 * procedural forward-motion steps, Restore is reversible, and Duplicate is
 * purely additive — same reasoning as InvoiceActions.
 */
export function ExpenseActions({ expense, onChanged }: ExpenseActionsProps) {
  const { can } = useMemberSession();
  const canUpdate = can("finance.update");
  const canCreate = can("finance.create");
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const isArchived = expense.status === "archived";
  const canApprove = canTransitionExpenseStatus(expense.status, "approved");
  const canMarkDue = canTransitionExpenseStatus(expense.status, "due");
  const canMarkPaid = canTransitionExpenseStatus(expense.status, "paid");
  const canMarkReimbursed = expense.reimbursable && canTransitionExpenseStatus(expense.status, "reimbursed");
  const canCancel = canTransitionExpenseStatus(expense.status, "cancelled");
  const canArchive = canTransitionExpenseStatus(expense.status, "archived");

  const runAction = async (name: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyAction(name);
    setActionError(null);
    const result = await action();
    setBusyAction(null);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    onChanged();
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    setDuplicateError(null);
    const result = await duplicateExpense(expense.id);
    setDuplicating(false);
    if (!result.success) {
      setDuplicateError(result.error);
      return;
    }
    router.push(`/finance/expenses/${result.data.id}`);
  };

  const duplicateButton = canCreate ? (
    <div>
      <Button variant="secondary" onClick={handleDuplicate} disabled={duplicating}>
        {duplicating ? "Duplicating…" : "Duplicate"}
      </Button>
      {duplicateError ? (
        <p role="alert" className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {duplicateError}
        </p>
      ) : null}
    </div>
  ) : null;

  if (isArchived) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {canUpdate ? (
            <div>
              <Button
                variant="secondary"
                onClick={() => runAction("restore", () => restoreExpense(expense.id))}
                disabled={busyAction === "restore"}
              >
                {busyAction === "restore" ? "Restoring…" : "Restore"}
              </Button>
            </div>
          ) : null}
          {duplicateButton}
        </div>
        {actionError ? (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {actionError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!isExpenseTerminal(expense.status) && canUpdate ? (
          <Link href={`/finance/expenses/${expense.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        ) : null}
        {canApprove && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("approve", () => approveExpense(expense.id))}
            disabled={busyAction === "approve"}
          >
            {busyAction === "approve" ? "Approving…" : "Approve"}
          </Button>
        ) : null}
        {canMarkDue && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("due", () => recordExpenseTransition(expense.id, { transition: "due" }))}
            disabled={busyAction === "due"}
          >
            {busyAction === "due" ? "Marking…" : "Mark Due"}
          </Button>
        ) : null}
        {canMarkPaid && canUpdate ? (
          <Button
            onClick={() => runAction("paid", () => recordExpenseTransition(expense.id, { transition: "paid" }))}
            disabled={busyAction === "paid"}
          >
            {busyAction === "paid" ? "Marking…" : "Mark Paid"}
          </Button>
        ) : null}
        {canMarkReimbursed && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() =>
              runAction("reimbursed", () => recordExpenseTransition(expense.id, { transition: "reimbursed" }))
            }
            disabled={busyAction === "reimbursed"}
          >
            {busyAction === "reimbursed" ? "Marking…" : "Mark Reimbursed"}
          </Button>
        ) : null}
        {canCancel && canUpdate ? (
          <Button variant="secondary" onClick={() => setModal("cancel")}>
            Cancel
          </Button>
        ) : null}
        {canArchive && canUpdate ? (
          <Button variant="secondary" onClick={() => setModal("archive")}>
            Archive
          </Button>
        ) : null}
        {duplicateButton}
      </div>

      {actionError ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {actionError}
        </p>
      ) : null}

      <ConfirmExpenseActionModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel Expense"
        description={`This marks "${expense.description}" as cancelled — a terminal state that can't be undone from here.`}
        confirmLabel="Cancel Expense"
        pendingLabel="Cancelling…"
        onConfirm={() => cancelExpense(expense.id)}
        onConfirmed={onChanged}
      />
      <ConfirmExpenseActionModal
        open={modal === "archive"}
        onClose={() => setModal(null)}
        title="Archive Expense"
        description={`This archives "${expense.description}". It will be hidden from the active Expenses list until restored.`}
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        onConfirm={() => archiveExpense(expense.id)}
        onConfirmed={onChanged}
      />
    </div>
  );
}
