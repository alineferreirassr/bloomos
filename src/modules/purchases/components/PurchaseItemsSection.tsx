"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import { removePurchaseItem } from "@/lib/data";
import { canEditPurchaseItems, canRemovePurchaseItem, canReceivePurchase } from "@/core/workflows/purchaseWorkflow";
import { formatMoney } from "@/lib/money";
import { PurchaseItemForm } from "@/modules/purchases/components/PurchaseItemForm";
import { ReceivePurchaseItemModal } from "@/modules/purchases/components/ReceivePurchaseItemModal";

interface PurchaseItemsSectionProps {
  purchase: Purchase;
  items: PurchaseItem[];
  onChanged: () => void;
}

type ModalState = { kind: "create" } | { kind: "edit"; item: PurchaseItem } | { kind: "receive"; item: PurchaseItem } | null;

/**
 * Mirrors ExhibitsSection's shape (a dedicated Card with its own Add button
 * + a modal add/edit form), not inline-editable table rows — items and the
 * parent Purchase are pre-fetched together by PurchaseDetailView and passed
 * down here, since the totals/receipt-summary cards next to this section
 * need the same item list. No reordering exists for PurchaseItem in the
 * repository contract (no reorderPurchaseItems method), so display_order is
 * assigned server-side only and never exposed as a user action here.
 */
export function PurchaseItemsSection({ purchase, items, onChanged }: PurchaseItemsSectionProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  const readOnly = !canEditPurchaseItems(purchase.status);
  const canReceive = canReceivePurchase(purchase.status);

  const handleRemove = async (item: PurchaseItem) => {
    if (!window.confirm(`Remove "${item.name}" from this purchase?`)) return;
    setRemoveError(null);
    const result = await removePurchaseItem(item.id);
    if (!result.success) {
      setRemoveError(result.error);
      return;
    }
    onChanged();
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">Line items</h3>
        {!readOnly ? (
          <Button variant="secondary" onClick={() => setModal({ kind: "create" })}>
            Add Item
          </Button>
        ) : null}
      </div>

      {readOnly && purchase.status !== "archived" ? (
        <p className="mt-2 text-xs text-text-muted">Items can only be added, edited, or removed while this purchase is a draft.</p>
      ) : null}

      {removeError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {removeError}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">No line items yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((item) => {
            const remaining = item.quantity_ordered - item.quantity_received;
            const actions: ActionMenuAction[] = [];
            if (!readOnly) {
              actions.push({ label: "Edit", onSelect: () => setModal({ kind: "edit", item }) });
            }
            if (canRemovePurchaseItem(purchase.status, item.quantity_received)) {
              actions.push({ label: "Remove", onSelect: () => handleRemove(item), destructive: true });
            }
            return (
              <li key={item.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">
                      {item.inventory_item_id ? (
                        <Link href={`/inventory/${item.inventory_item_id}`} className="hover:text-accent">
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {item.sku ? `SKU: ${item.sku} · ` : ""}
                      {item.quantity_ordered} × {formatMoney(item.unit_cost_minor, purchase.currency)} ={" "}
                      {formatMoney(item.line_subtotal_minor, purchase.currency)}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Received: {item.quantity_received} / {item.quantity_ordered}
                      {remaining > 0 ? ` (${remaining} remaining)` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canReceive && remaining > 0 ? (
                      <Button type="button" variant="secondary" onClick={() => setModal({ kind: "receive", item })}>
                        Receive
                      </Button>
                    ) : null}
                    {actions.length > 0 ? <ActionMenu actions={actions} /> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PurchaseItemForm
        key={modal?.kind === "edit" ? modal.item.id : modal?.kind === "create" ? "create" : "closed"}
        purchaseId={purchase.id}
        item={modal?.kind === "edit" ? modal.item : null}
        open={modal?.kind === "create" || modal?.kind === "edit"}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          onChanged();
        }}
      />

      {modal?.kind === "receive" ? (
        <ReceivePurchaseItemModal item={modal.item} open onClose={() => setModal(null)} onReceived={onChanged} />
      ) : null}
    </Card>
  );
}
