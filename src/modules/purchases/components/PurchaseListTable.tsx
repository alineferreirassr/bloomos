"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Purchase } from "@/types/purchase";
import type { Vendor } from "@/types/vendor";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
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
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Purchase #</TableHeaderCell>
            <TableHeaderCell>Vendor</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Order date</TableHeaderCell>
            <TableHeaderCell>Expected delivery</TableHeaderCell>
            <TableHeaderCell>Total</TableHeaderCell>
            <TableHeaderCell>Receipt</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map(({ purchase, vendor }) => (
            <TableRow key={purchase.id}>
              <TableCell>
                <Link href={`/purchases/${purchase.id}`} className="block max-w-[10rem] truncate text-[15px] font-medium text-text hover:text-accent">
                  {purchase.purchase_number}
                </Link>
              </TableCell>
              <TableCell className="text-text-muted">
                {vendor ? (
                  <Link href={`/vendors/${vendor.id}`} className="hover:text-accent">
                    {vendor.company_name}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <PurchaseStatusBadge status={purchase.status} />
              </TableCell>
              <TableCell className="text-text-muted">{formatPurchaseDate(purchase.order_date)}</TableCell>
              <TableCell className="text-text-muted">{formatPurchaseDate(purchase.expected_delivery_date)}</TableCell>
              <TableCell className="text-text-muted">{formatMoney(purchase.total_minor, purchase.currency)}</TableCell>
              <TableCell className="text-text-muted">{receiptProgressLabel(purchase.status)}</TableCell>
              <TableCell>
                <ActionMenu actions={actionsFor(purchase)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
