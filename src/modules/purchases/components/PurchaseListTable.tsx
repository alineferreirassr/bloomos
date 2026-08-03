"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Purchase } from "@/types/purchase";
import type { Vendor } from "@/types/vendor";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { archivePurchase, restorePurchase } from "@/lib/data";
import { PurchaseStatusBadge } from "@/modules/purchases/components/PurchaseStatusBadge";
import { formatMoney } from "@/lib/money";
import { formatPurchaseDate } from "@/modules/purchases/mappers";
import { receiptProgressLabel } from "@/modules/purchases/purchaseStats";

export interface PurchaseListRow {
  purchase: Purchase;
  vendor: Vendor | undefined;
}

interface PurchaseListTableProps {
  rows: PurchaseListRow[];
  onChanged: () => void;
}

export function PurchaseListTable({ rows, onChanged }: PurchaseListTableProps) {
  const router = useRouter();

  const actionsFor = (purchase: Purchase): ActionMenuAction[] => {
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
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Purchase #</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Vendor</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Status</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Order date</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Expected delivery</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Total</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Receipt</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ purchase, vendor }) => (
            <tr key={purchase.id} className="transition-colors duration-150 hover:bg-accent-100/40">
              <td className="border-b border-border px-2.5 py-2">
                <Link href={`/purchases/${purchase.id}`} className="block max-w-[10rem] truncate font-medium text-text hover:text-accent">
                  {purchase.purchase_number}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {vendor ? (
                  <Link href={`/vendors/${vendor.id}`} className="hover:text-accent">
                    {vendor.company_name}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <PurchaseStatusBadge status={purchase.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{formatPurchaseDate(purchase.order_date)}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{formatPurchaseDate(purchase.expected_delivery_date)}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{formatMoney(purchase.total_minor, purchase.currency)}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{receiptProgressLabel(purchase.status)}</td>
              <td className="border-b border-border px-2.5 py-2">
                <ActionMenu actions={actionsFor(purchase)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
