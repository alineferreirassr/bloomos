"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { receivePurchaseItem } from "@/lib/data";
import type { PurchaseItem } from "@/types/purchaseItem";

interface ReceivePurchaseItemModalProps {
  item: PurchaseItem;
  open: boolean;
  onClose: () => void;
  /** Called after a successful receipt — the caller refreshes the Purchase, its items, receipt summary, and Timeline. This modal never updates Inventory or Purchase status itself; receivePurchaseItem (the atomic RPC boundary) is the only thing that does. */
  onReceived: () => void;
}

export function ReceivePurchaseItemModal({ item, open, onClose, onReceived }: ReceivePurchaseItemModalProps) {
  const remaining = item.quantity_ordered - item.quantity_received;
  const [quantity, setQuantity] = useState(String(Math.max(remaining, 0)));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedQuantity = Number(quantity);
  const isValidQuantity = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= remaining;
  const resultingReceived = isValidQuantity ? item.quantity_received + parsedQuantity : item.quantity_received;

  const handleClose = () => {
    setQuantity(String(Math.max(remaining, 0)));
    setReason("");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!isValidQuantity) {
      setError(parsedQuantity <= 0 ? "Enter a quantity greater than zero." : `Cannot receive more than the remaining ${remaining}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await receivePurchaseItem(item.id, { quantity_received: parsedQuantity, reason: reason.trim() || null });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onReceived();
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Receive: ${item.name}`}>
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-muted">Ordered</dt>
            <dd className="text-text">{item.quantity_ordered}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Already received</dt>
            <dd className="text-text">{item.quantity_received}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Remaining</dt>
            <dd className="text-text">{remaining}</dd>
          </div>
        </dl>

        <FormField label="Quantity to receive" htmlFor="receive_quantity" required>
          <Input
            id="receive_quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            invalid={!isValidQuantity}
          />
        </FormField>

        <p className="text-xs text-text-muted">
          {isValidQuantity
            ? `This will bring received quantity to ${resultingReceived} of ${item.quantity_ordered}.`
            : "Enter a whole number between 1 and the remaining quantity."}
        </p>

        <FormField label="Reason" htmlFor="receive_reason" hint="Optional">
          <Textarea id="receive_reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleSubmit} disabled={submitting || !isValidQuantity}>
            {submitting ? "Receiving…" : "Receive"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
