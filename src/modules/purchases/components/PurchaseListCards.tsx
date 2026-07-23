"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { archivePurchase, restorePurchase } from "@/lib/data";
import { PurchaseStatusBadge } from "@/modules/purchases/components/PurchaseStatusBadge";
import { formatMoney } from "@/lib/money";
import { formatPurchaseDate } from "@/modules/purchases/mappers";
import { receiptProgressLabel } from "@/modules/purchases/purchaseStats";
import type { PurchaseListRow } from "@/modules/purchases/components/PurchaseListTable";

interface PurchaseListCardsProps {
  rows: PurchaseListRow[];
  onChanged: () => void;
}

export function PurchaseListCards({ rows, onChanged }: PurchaseListCardsProps) {
  const router = useRouter();

  const actionsFor = (purchase: PurchaseListRow["purchase"]): ActionMenuAction[] => {
    const isArchived = purchase.archived_at !== null;
    const actions: ActionMenuAction[] = [{ label: "View", onSelect: () => router.push(`/purchases/${purchase.id}`) }];
    if (!isArchived) {
      actions.push({
        label: "Archive",
        onSelect: async () => {
          if (!window.confirm(`Archive "${purchase.purchase_number}"? It stays readable, but it can't be edited or receive stock until restored.`)) return;
          await archivePurchase(purchase.id);
          onChanged();
        },
        destructive: true,
      });
    } else {
      actions.push({
        label: "Restore",
        onSelect: async () => {
          await restorePurchase(purchase.id);
          onChanged();
        },
      });
    }
    return actions;
  };

  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ purchase, vendor }) => (
        <Card key={purchase.id}>
          <div className="flex items-start justify-between gap-3">
            <Link href={`/purchases/${purchase.id}`} className="block min-w-0 flex-1">
              <p className="truncate font-medium tracking-tight text-text">{purchase.purchase_number}</p>
              <p className="mt-0.5 text-xs text-text-muted">{vendor ? vendor.company_name : "No vendor"}</p>
            </Link>
            <div className="flex shrink-0 items-start gap-2">
              <PurchaseStatusBadge status={purchase.status} />
              <ActionMenu actions={actionsFor(purchase)} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
            <span>Order: {formatPurchaseDate(purchase.order_date)}</span>
            <span>Expected: {formatPurchaseDate(purchase.expected_delivery_date)}</span>
            <span>Receipt: {receiptProgressLabel(purchase.status)}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-text">{formatMoney(purchase.total_minor, purchase.currency)}</p>
        </Card>
      ))}
    </div>
  );
}
