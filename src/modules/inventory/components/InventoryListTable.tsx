"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InventoryItem } from "@/types/inventoryItem";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { Badge } from "@/components/ui/Badge";
import { archiveInventoryItem, restoreInventoryItem } from "@/lib/data";
import { InventoryStatusBadge } from "@/modules/inventory/components/InventoryStatusBadge";
import { InventoryConditionBadge } from "@/modules/inventory/components/InventoryConditionBadge";
import { isInventoryItemLowStock } from "@/modules/inventory/inventoryStats";

interface InventoryListTableProps {
  items: InventoryItem[];
  onChanged: () => void;
}

export function InventoryListTable({ items, onChanged }: InventoryListTableProps) {
  const router = useRouter();

  const actionsFor = (item: InventoryItem): ActionMenuAction[] => {
    const isArchived = item.archived_at !== null;
    const actions: ActionMenuAction[] = [{ label: "View", onSelect: () => router.push(`/inventory/${item.id}`) }];
    if (!isArchived) {
      actions.push({ label: "Edit", onSelect: () => router.push(`/inventory/${item.id}/edit`) });
      actions.push({
        label: "Archive",
        onSelect: async () => {
          if (!window.confirm(`Archive "${item.name}"? Archived items can't be edited or receive new movements until restored.`)) return;
          await archiveInventoryItem(item.id);
          onChanged();
        },
        destructive: true,
      });
    } else {
      actions.push({
        label: "Restore",
        onSelect: async () => {
          await restoreInventoryItem(item.id);
          onChanged();
        },
      });
    }
    return actions;
  };

  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Name</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">SKU</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Category</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Type</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Status</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Condition</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">On hand</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Available</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Reserved</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Location</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const lowStock = isInventoryItemLowStock(item);
            return (
              <tr key={item.id} className="transition-colors duration-150 hover:bg-accent-100/40">
                <td className="border-b border-border px-2.5 py-2">
                  <Link href={`/inventory/${item.id}`} className="block max-w-[16rem] truncate font-medium text-text hover:text-accent">
                    {item.name}
                  </Link>
                </td>
                <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.sku ?? "—"}</td>
                <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.category ?? "—"}</td>
                <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.item_type === "consumable" ? "Consumable" : "Reusable"}</td>
                <td className="border-b border-border px-2.5 py-2">
                  <InventoryStatusBadge status={item.status} />
                </td>
                <td className="border-b border-border px-2.5 py-2">
                  <InventoryConditionBadge condition={item.condition} />
                </td>
                <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.quantity_on_hand}</td>
                <td className="border-b border-border px-2.5 py-2">
                  <span className={lowStock ? "font-medium text-amber-700 dark:text-amber-400" : "text-text-muted"}>
                    {item.quantity_available}
                    {lowStock ? (
                      <Badge tone="warning" className="ml-1.5 align-middle">
                        Low stock
                      </Badge>
                    ) : null}
                  </span>
                </td>
                <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.quantity_reserved}</td>
                <td className="border-b border-border px-2.5 py-2 text-text-muted">{item.storage_location ?? "—"}</td>
                <td className="border-b border-border px-2.5 py-2">
                  <ActionMenu actions={actionsFor(item)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
