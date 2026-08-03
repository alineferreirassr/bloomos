"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cancelPayment, markPaymentFailed, markPaymentProcessing, markPaymentSucceeded } from "@/lib/data";
import type { Payment } from "@/types/payment";
import { canTransitionPaymentStatus, isPaymentFinal, isPaymentRefundable } from "@/core/workflows/paymentWorkflow";
import { ConfirmPaymentActionModal } from "@/modules/finance/components/ConfirmPaymentActionModal";
import { RefundPaymentModal } from "@/modules/finance/components/RefundPaymentModal";
import { PaymentEditModal } from "@/modules/finance/components/PaymentEditModal";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface PaymentActionsProps {
  payment: Payment;
  onChanged: () => void;
}

type ModalKind = "edit" | "failed" | "cancel" | "refund" | null;

/**
 * Every transition here goes through the existing dedicated data-layer
 * action — markPaymentProcessing/markPaymentSucceeded/markPaymentFailed/
 * refundPayment/cancelPayment, exactly the set built in the Finance domain
 * foundation. Confirmation modals gate Mark Failed and Cancel (terminal);
 * Mark Processing/Mark Succeeded are procedural forward-motion steps
 * (no modal); Refund gets its own dedicated modal (amount input, not a
 * plain yes/no confirmation).
 */
export function PaymentActions({ payment, onChanged }: PaymentActionsProps) {
  const { can } = useMemberSession();
  const canUpdate = can("finance.update");
  // finance.view/finance.update alone never imply finance.refund — a
  // refund is the one Finance action gated by its own dedicated permission.
  const canRefundPermission = can("finance.refund");
  const [modal, setModal] = useState<ModalKind>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canEdit = !isPaymentFinal(payment.status);
  const canMarkProcessing = canTransitionPaymentStatus(payment.status, "processing");
  const canMarkSucceeded = canTransitionPaymentStatus(payment.status, "succeeded");
  const canMarkFailed = canTransitionPaymentStatus(payment.status, "failed");
  const canRefund = isPaymentRefundable(payment.status);
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
    </div>
  );
}
