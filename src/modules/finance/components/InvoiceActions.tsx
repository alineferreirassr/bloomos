"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  archiveInvoice,
  duplicateInvoice,
  issueInvoice,
  markInvoiceOverdue,
  markInvoiceViewed,
  restoreInvoice,
  sendInvoice,
  voidInvoice,
} from "@/lib/data";
import type { Invoice } from "@/types/invoice";
import { canTransitionInvoiceStatus, isInvoiceTerminal } from "@/core/workflows/invoiceWorkflow";
import { ConfirmInvoiceActionModal } from "@/modules/finance/components/ConfirmInvoiceActionModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface InvoiceActionsProps {
  invoice: Invoice;
  onChanged: () => void;
}

type ModalKind = "void" | "archive" | null;

/**
 * Every transition here goes through the existing dedicated data-layer
 * action (never a hardcoded status write) — issueInvoice/sendInvoice/
 * markInvoiceViewed/markInvoiceOverdue/voidInvoice/archiveInvoice/
 * restoreInvoice/duplicateInvoice, exactly the set built in the Finance
 * domain foundation. Confirmation modals gate only Void/Archive (terminal-
 * or-destructive); Issue/Send/Mark Viewed/Mark Overdue are procedural
 * forward-motion steps, Restore is reversible, and Duplicate is purely
 * additive — same reasoning as ContractActions.
 */
export function InvoiceActions({ invoice, onChanged }: InvoiceActionsProps) {
  const { can } = useMemberSession();
  const canUpdate = can("finance.update");
  const canCreate = can("finance.create");
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const isArchived = invoice.status === "archived";
  const canIssue = canTransitionInvoiceStatus(invoice.status, "issued");
  const canSend = canTransitionInvoiceStatus(invoice.status, "sent");
  const canMarkViewed = invoice.status === "sent";
  const canMarkOverdue = canTransitionInvoiceStatus(invoice.status, "overdue") && invoice.due_date !== null;
  const canVoid = canTransitionInvoiceStatus(invoice.status, "voided");
  const canArchive = canTransitionInvoiceStatus(invoice.status, "archived");
  const canRecordPayment = !isInvoiceTerminal(invoice.status) && invoice.status !== "paid";

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
    const result = await duplicateInvoice(invoice.id);
    setDuplicating(false);
    if (!result.success) {
      setDuplicateError(result.error);
      return;
    }
    router.push(`/finance/invoices/${result.data.id}`);
  };

  const recordPaymentHref = `/finance/payments/new?invoiceId=${invoice.id}&clientId=${invoice.client_id}${
    invoice.event_id ? `&eventId=${invoice.event_id}` : ""
  }${invoice.contract_id ? `&contractId=${invoice.contract_id}` : ""}`;

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
                onClick={() => runAction("restore", () => restoreInvoice(invoice.id))}
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
        {!isInvoiceTerminal(invoice.status) && canUpdate ? (
          <Link href={`/finance/invoices/${invoice.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        ) : null}
        {canIssue && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("issue", () => issueInvoice(invoice.id))}
            disabled={busyAction === "issue"}
          >
            {busyAction === "issue" ? "Issuing…" : "Issue"}
          </Button>
        ) : null}
        {canSend && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("send", () => sendInvoice(invoice.id))}
            disabled={busyAction === "send"}
          >
            {busyAction === "send" ? "Sending…" : "Send"}
          </Button>
        ) : null}
        {canMarkViewed && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("viewed", () => markInvoiceViewed(invoice.id))}
            disabled={busyAction === "viewed"}
          >
            {busyAction === "viewed" ? "Marking…" : "Mark Viewed"}
          </Button>
        ) : null}
        {canMarkOverdue && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("overdue", () => markInvoiceOverdue(invoice.id))}
            disabled={busyAction === "overdue"}
          >
            {busyAction === "overdue" ? "Marking…" : "Mark Overdue"}
          </Button>
        ) : null}
        {canRecordPayment && canCreate ? (
          <Link href={recordPaymentHref}>
            <Button>Record Payment</Button>
          </Link>
        ) : null}
        {canVoid && canUpdate ? (
          <Button variant="secondary" onClick={() => setModal("void")}>
            Void
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

      <ConfirmInvoiceActionModal
        open={modal === "void"}
        onClose={() => setModal(null)}
        title="Void Invoice"
        description={`This marks "${invoice.title}" as voided — a terminal state that can't be undone from here.`}
        confirmLabel="Void"
        pendingLabel="Voiding…"
        onConfirm={() => voidInvoice(invoice.id)}
        onConfirmed={onChanged}
      />
      <ConfirmInvoiceActionModal
        open={modal === "archive"}
        onClose={() => setModal(null)}
        title="Archive Invoice"
        description={`This archives "${invoice.title}". It will be hidden from the active Invoices list until restored.`}
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        onConfirm={() => archiveInvoice(invoice.id)}
        onConfirmed={onChanged}
      />
    </div>
  );
}
