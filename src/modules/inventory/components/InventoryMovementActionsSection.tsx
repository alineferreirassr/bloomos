"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { recordInventoryMovement } from "@/lib/data";
import { getInventoryMovementDelta } from "@/core/workflows/inventoryWorkflow";
import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryMovementType } from "@/core/enums/inventoryMovementType";

interface MovementAction {
  type: InventoryMovementType;
  label: string;
  description: string;
}

/**
 * One user-friendly action per movement type this workflow fully supports —
 * `initial_stock` is excluded (create-only, collected on the "New Item"
 * form instead). "Send to repair"/"return from repair" are deliberately NOT
 * offered here: there is no matching InventoryMovementType for a condition
 * change (only `condition` itself, edited via "Edit Metadata"), and the task
 * that authorized this section explicitly forbids inventing a new movement
 * type just to support a UI label.
 */
const MOVEMENT_ACTIONS: MovementAction[] = [
  { type: "purchase", label: "Receive stock", description: "Adds stock to on-hand and available." },
  { type: "reservation", label: "Reserve", description: "Moves stock from available to reserved." },
  { type: "reservation_release", label: "Release reservation", description: "Moves stock from reserved back to available." },
  { type: "event_checkout", label: "Checkout / consume", description: "Removes reserved stock from hand." },
  { type: "event_return", label: "Return stock", description: "Adds stock back to hand and available." },
  { type: "adjustment_increase", label: "Adjustment (increase)", description: "Manually increases on-hand and available stock." },
  { type: "adjustment_decrease", label: "Adjustment (decrease)", description: "Manually decreases on-hand and available stock." },
  { type: "damage", label: "Mark damaged", description: "Removes damaged stock from on-hand and available." },
  { type: "loss", label: "Report loss", description: "Removes lost stock from on-hand and available." },
  { type: "disposal", label: "Dispose", description: "Removes disposed stock from on-hand and available." },
];

interface InventoryMovementActionsSectionProps {
  item: InventoryItem;
  onChanged: () => void;
}

export function InventoryMovementActionsSection({ item, onChanged }: InventoryMovementActionsSectionProps) {
  const [activeAction, setActiveAction] = useState<MovementAction | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (item.archived_at) {
    return <p className="text-sm text-text-muted">This item is archived and can&rsquo;t receive new stock movements. Restore it first.</p>;
  }

  const openAction = (action: MovementAction) => {
    setActiveAction(action);
    setQuantity("");
    setReason("");
    setReferenceType("");
    setReferenceId("");
    setError(null);
  };

  const close = () => {
    if (isSubmitting) return;
    setActiveAction(null);
  };

  const parsedQuantity = Number(quantity);
  const isValidQuantity = quantity.trim() !== "" && Number.isInteger(parsedQuantity) && parsedQuantity > 0;
  const delta = activeAction && isValidQuantity ? getInventoryMovementDelta(activeAction.type, parsedQuantity) : null;

  const submit = async () => {
    if (!activeAction || !isValidQuantity || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await recordInventoryMovement(item.id, {
        movement_type: activeAction.type,
        quantity: parsedQuantity,
        reason: reason.trim() || null,
        reference_type: referenceType.trim() || null,
        reference_id: referenceId.trim() || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setActiveAction(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this movement. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {MOVEMENT_ACTIONS.map((action) => (
          <Button key={action.type} type="button" variant="secondary" onClick={() => openAction(action)}>
            {action.label}
          </Button>
        ))}
      </div>

      <Modal open={!!activeAction} onClose={close} title={activeAction?.label ?? ""}>
        {activeAction ? (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">{activeAction.description}</p>

            <dl className="grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-sm">
              <div>
                <dt className="text-xs text-text-muted">On hand</dt>
                <dd className="text-text">
                  {item.quantity_on_hand}
                  {delta ? ` → ${item.quantity_on_hand + delta.onHand}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Available</dt>
                <dd className="text-text">
                  {item.quantity_available}
                  {delta ? ` → ${item.quantity_available + delta.available}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Reserved</dt>
                <dd className="text-text">
                  {item.quantity_reserved}
                  {delta ? ` → ${item.quantity_reserved + delta.reserved}` : ""}
                </dd>
              </div>
            </dl>

            <FormField label="Quantity" htmlFor="movement_quantity" required error={quantity.trim() !== "" && !isValidQuantity ? "Enter a whole number greater than zero" : undefined}>
              <Input
                id="movement_quantity"
                inputMode="numeric"
                autoFocus
                invalid={quantity.trim() !== "" && !isValidQuantity}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </FormField>
            <FormField label="Reason" htmlFor="movement_reason">
              <Input id="movement_reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Reference type" htmlFor="movement_reference_type" hint="Optional">
                <Input id="movement_reference_type" value={referenceType} onChange={(event) => setReferenceType(event.target.value)} />
              </FormField>
              <FormField label="Reference ID" htmlFor="movement_reference_id" hint="Optional">
                <Input id="movement_reference_id" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} />
              </FormField>
            </div>

            {error ? (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="button" onClick={submit} disabled={!isValidQuantity || isSubmitting}>
                {isSubmitting ? "Recording…" : "Confirm"}
              </Button>
              <Button type="button" variant="secondary" onClick={close} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
