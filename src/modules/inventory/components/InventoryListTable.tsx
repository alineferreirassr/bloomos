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
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Name</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">SKU</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Category</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Type</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Status</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Condition</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">On hand</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Available</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Reserved</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Location</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map((item) => {
            const lowStock = isInventoryItemLowStock(item);
            return (
              <tr key={item.id} className="transition-colors duration-150 hover:bg-accent-100/25">
                <td className="px-5 py-4">
                  <Link href={`/inventory/${item.id}`} className="block max-w-[16rem] truncate text-[15px] font-medium text-text hover:text-accent">
                    {item.name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-text-muted">{item.sku ?? "—"}</td>
                <td className="px-5 py-4 text-text-muted">{item.category ?? "—"}</td>
                <td className="px-5 py-4 text-text-muted">{item.item_type === "consumable" ? "Consumable" : "Reusable"}</td>
                <td className="px-5 py-4">
                  <InventoryStatusBadge status={item.status} />
                </td>
                <td className="px-5 py-4">
                  <InventoryConditionBadge condition={item.condition} />
                </td>
                <td className="px-5 py-4 text-text-muted">{item.quantity_on_hand}</td>
                <td className="px-5 py-4">
                  <span className={lowStock ? "font-medium text-amber-700 dark:text-amber-400" : "text-text-muted"}>
                    {item.quantity_available}
                    {lowStock ? (
                      <Badge tone="warning" className="ml-1.5 align-middle">
                        Low stock
                      </Badge>
                    ) : null}
                  </span>
                </td>
                <td className="px-5 py-4 text-text-muted">{item.quantity_reserved}</td>
                <td className="px-5 py-4 text-text-muted">{item.storage_location ?? "—"}</td>
                <td className="px-5 py-4">
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
