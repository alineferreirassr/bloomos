"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cancelPayment, markPaymentFailed, markPaymentProcessing, markPaymentSucceeded } from "@/lib/data";
import type { Payment } from "@/types/payment";
import { canTransitionPaymentStatus, isPaymentFinal, isPaymentRefundable } from "@/core/workflows/paymentWorkflow";
import { ConfirmPaymentActionModal } from "@/modules/finance/components/ConfirmPaymentActionModal";
import { RefundPaymentModal } from "@/modules/finance/components/RefundPaymentModal";
import { ReverseDepositApplicationModal } from "@/modules/finance/components/ReverseDepositApplicationModal";
import { PaymentEditModal } from "@/modules/finance/components/PaymentEditModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface PaymentActionsProps {
  payment: Payment;
  onChanged: () => void;
  /**
   * Finance F2.1C-E-C-B: only meaningful when `payment` is itself a
   * Deposit Application row. Derived by the caller (PaymentDetailView)
   * from the invoice's sibling payments — see its own doc comment. Server
   * remains authoritative via P1140; this only avoids offering a Reverse
   * action that's already guaranteed to be rejected.
   */
  depositApplicationAlreadyReversed?: boolean;
}

type ModalKind = "edit" | "failed" | "cancel" | "refund" | "reverse" | null;

/**
 * Every transition here goes through the existing dedicated data-layer
 * action — markPaymentProcessing/markPaymentSucceeded/markPaymentFailed/
 * refundPayment/cancelPayment/reverseDepositApplication, exactly the set
 * built in the Finance domain foundation. Confirmation modals gate Mark
 * Failed and Cancel (terminal); Mark Processing/Mark Succeeded are
 * procedural forward-motion steps (no modal); Refund and Reverse
 * Application each get their own dedicated modal (not a plain yes/no
 * confirmation).
 */
export function PaymentActions({ payment, onChanged, depositApplicationAlreadyReversed }: PaymentActionsProps) {
  const { can } = useMemberSession();
  const canUpdate = can("finance.update");
  // finance.view/finance.update alone never imply finance.refund — Refund
  // and Reverse Application are the two Finance actions gated by this same
  // dedicated permission (a Deposit Application Reversal is the closest
  // conceptual sibling to a Refund: both undo a settled financial position).
  const canRefundPermission = can("finance.refund");
  const [modal, setModal] = useState<ModalKind>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canEdit = !isPaymentFinal(payment.status);
  const canMarkProcessing = canTransitionPaymentStatus(payment.status, "processing");
  const canMarkSucceeded = canTransitionPaymentStatus(payment.status, "succeeded");
  const canMarkFailed = canTransitionPaymentStatus(payment.status, "failed");
  // A Deposit Application (payment_type "adjustment", reference
  // "deposit_application_of:...") or its own Reversal row (payment_type
  // "refund", reference "deposit_application_reversal_of:...") are never
  // genuinely refundable — isPaymentRefundable is status-only and doesn't
  // know this, so it would otherwise offer a Refund button guaranteed to
  // fail server-side.
  const isDepositApplication =
    payment.payment_type === "adjustment" && !!payment.reference?.startsWith("deposit_application_of:");
  const isDepositApplicationReversal =
    payment.payment_type === "refund" && !!payment.reference?.startsWith("deposit_application_reversal_of:");
  const canRefund = isPaymentRefundable(payment.status) && !isDepositApplication && !isDepositApplicationReversal;
  const canReverse = isDepositApplication && !depositApplicationAlreadyReversed;
  const canCancel = canTransitionPaymentStatus(payment.status, "cancelled");

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {canEdit && canUpdate ? (
          <Button variant="secondary" onClick={() => setModal("edit")}>
            Edit
          </Button>
        ) : null}
        {canMarkProcessing && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("processing", () => markPaymentProcessing(payment.id))}
            disabled={busyAction === "processing"}
          >
            {busyAction === "processing" ? "Marking…" : "Mark Processing"}
          </Button>
        ) : null}
        {canMarkSucceeded && canUpdate ? (
          <Button
            variant="secondary"
            onClick={() => runAction("succeeded", () => markPaymentSucceeded(payment.id))}
            disabled={busyAction === "succeeded"}
          >
            {busyAction === "succeeded" ? "Marking…" : "Mark Succeeded"}
          </Button>
        ) : null}
        {canMarkFailed && canUpdate ? (
          <Button variant="secondary" onClick={() => setModal("failed")}>
            Mark Failed
          </Button>
        ) : null}
        {canRefund && canRefundPermission ? (
          <Button variant="secondary" onClick={() => setModal("refund")}>
            Refund
          </Button>
        ) : null}
        {canReverse && canRefundPermission ? (
          <Button variant="secondary" onClick={() => setModal("reverse")}>
            Reverse Application
          </Button>
        ) : null}
        {canCancel && canUpdate ? (
          <Button variant="secondary" onClick={() => setModal("cancel")}>
            Cancel
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {actionError}
        </p>
      ) : null}

      <PaymentEditModal
        payment={payment}
        open={modal === "edit"}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          onChanged();
        }}
      />

      <ConfirmPaymentActionModal
        open={modal === "failed"}
        onClose={() => setModal(null)}
        title="Mark Payment Failed"
        description="This marks the payment as failed — a terminal state that can't be undone from here."
        confirmLabel="Mark Failed"
        pendingLabel="Marking…"
        onConfirm={() => markPaymentFailed(payment.id)}
        onConfirmed={onChanged}
      />
      <ConfirmPaymentActionModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel Payment"
        description="This cancels the payment — a terminal state that can't be undone from here."
        confirmLabel="Cancel Payment"
        pendingLabel="Cancelling…"
        onConfirm={() => cancelPayment(payment.id)}
        onConfirmed={onChanged}
      />
      <RefundPaymentModal
        open={modal === "refund"}
        onClose={() => setModal(null)}
        payment={payment}
        onRefunded={onChanged}
      />
      <ReverseDepositApplicationModal
        open={modal === "reverse"}
        onClose={() => setModal(null)}
        payment={payment}
        onReversed={onChanged}
      />
    </div>
  );
}
