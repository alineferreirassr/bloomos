"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { InventoryItem } from "@/types/inventoryItem";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { archiveInventoryItem, restoreInventoryItem } from "@/lib/data";
import { InventoryStatusBadge } from "@/modules/inventory/components/InventoryStatusBadge";
import { InventoryConditionBadge } from "@/modules/inventory/components/InventoryConditionBadge";
import { isInventoryItemLowStock } from "@/modules/inventory/inventoryStats";

interface InventoryListCardsProps {
  items: InventoryItem[];
  onChanged: () => void;
}

export function InventoryListCards({ items, onChanged }: InventoryListCardsProps) {
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
    <div className="space-y-3 md:hidden">
      {items.map((item) => {
        const lowStock = isInventoryItemLowStock(item);
        return (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <Link href={`/inventory/${item.id}`} className="block min-w-0 flex-1">
                <p className="truncate font-medium tracking-tight text-text">{item.name}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {item.sku ?? "No SKU"}
                  {item.category ? ` · ${item.category}` : ""}
                </p>
              </Link>
              <div className="flex shrink-0 items-start gap-2">
                <InventoryStatusBadge status={item.status} />
                <ActionMenu actions={actionsFor(item)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>On hand: {item.quantity_on_hand}</span>
              <span className={lowStock ? "font-medium text-amber-700 dark:text-amber-400" : undefined}>
                Available: {item.quantity_available}
              </span>
              <span>Reserved: {item.quantity_reserved}</span>
              {item.storage_location ? <span>{item.storage_location}</span> : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <InventoryConditionBadge condition={item.condition} />
              {lowStock ? <Badge tone="warning">Low stock</Badge> : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
