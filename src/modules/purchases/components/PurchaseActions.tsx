"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { submitPurchase, cancelPurchase, archivePurchase, restorePurchase } from "@/lib/data";
import type { Purchase } from "@/types/purchase";
import { canTransitionPurchaseStatus, canEditPurchase } from "@/core/workflows/purchaseWorkflow";
import { ConfirmPurchaseActionModal } from "@/modules/purchases/components/ConfirmPurchaseActionModal";

interface PurchaseActionsProps {
  purchase: Purchase;
  onChanged: () => void;
}

type ModalKind = "cancel" | "archive" | null;

/**
 * Every transition here goes through the existing dedicated data-layer
 * action (never a hardcoded status write) — submitPurchase/cancelPurchase/
 * archivePurchase/restorePurchase, exactly the set the repository exposes.
 * No generic status dropdown exists. Mirrors InvoiceActions' shape: workflow
 * helpers are called directly to decide each button's visibility, terminal-
 * or-destructive actions (Cancel, Archive) route through a confirmation
 * modal, forward-motion (Submit) and reversible (Restore) actions fire
 * immediately. No permission gating — like Inventory/Vendor, no
 * `purchases.*` permission exists in the catalog, so this matches their
 * precedent of skipping `useMemberSession()` entirely rather than inventing
 * a new permission set unprompted.
 */
export function PurchaseActions({ purchase, onChanged }: PurchaseActionsProps) {
  const [modal, setModal] = useState<ModalKind>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isArchived = purchase.status === "archived";
  const canEdit = canEditPurchase(purchase.status);
  const canSubmit = canTransitionPurchaseStatus(purchase.status, "submitted");
  const canCancel = canTransitionPurchaseStatus(purchase.status, "cancelled");
  const canArchive = canTransitionPurchaseStatus(purchase.status, "archived");

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

  if (isArchived) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => runAction("restore", () => restorePurchase(purchase.id))}
            disabled={busyAction === "restore"}
          >
            {busyAction === "restore" ? "Restoring…" : "Restore"}
          </Button>
        </div>
        {actionError ? (
          <p role="alert" className="text-xs text-danger">
            {actionError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <Link href={`/purchases/${purchase.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        ) : null}
        {canSubmit ? (
          <Button
            variant="secondary"
            onClick={() => runAction("submit", () => submitPurchase(purchase.id))}
            disabled={busyAction === "submit"}
          >
            {busyAction === "submit" ? "Submitting…" : "Submit"}
          </Button>
        ) : null}
        {canCancel ? (
          <Button variant="secondary" onClick={() => setModal("cancel")}>
            Cancel
          </Button>
        ) : null}
        {canArchive ? (
          <Button variant="secondary" onClick={() => setModal("archive")}>
            Archive
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="text-xs text-danger">
          {actionError}
        </p>
      ) : null}

      <ConfirmPurchaseActionModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title="Cancel Purchase"
        description={`This marks "${purchase.purchase_number}" as cancelled. It can still be archived afterward, but it will no longer accept receiving.`}
        confirmLabel="Cancel Purchase"
        pendingLabel="Cancelling…"
        onConfirm={() => cancelPurchase(purchase.id)}
        onConfirmed={onChanged}
      />
      <ConfirmPurchaseActionModal
        open={modal === "archive"}
        onClose={() => setModal(null)}
        title="Archive Purchase"
        description={`This archives "${purchase.purchase_number}". It will be hidden from the active Purchases list and become read-only until restored.`}
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        onConfirm={() => archivePurchase(purchase.id)}
        onConfirmed={onChanged}
      />
    </div>
  );
}
