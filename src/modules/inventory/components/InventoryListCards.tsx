"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
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
          <LuxuryCard key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <Link href={`/inventory/${item.id}`} className="block min-w-0 flex-1">
                <p className="truncate font-medium tracking-tight text-text">{item.name}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {item.category ?? "Uncategorized"}
                  {item.sku ? ` · ${item.sku}` : ""}
                </p>
              </Link>
              <div className="flex shrink-0 items-start gap-2">
                <InventoryStatusBadge status={item.status} />
                <ActionMenu actions={actionsFor(item)} />
              </div>
            </div>

            {/* "Available" is the number a field team member needs fastest —
                sized like EventHealthCard's primary score figure so it reads
                before anything else on the card. */}
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Available</p>
                <span
                  className={`font-serif text-[32px] leading-tight font-semibold tabular-nums ${
                    lowStock ? "text-amber-700 dark:text-amber-400" : "text-text"
                  }`}
                >
                  {item.quantity_available}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-right text-xs text-text-muted">
                <span>
                  On hand {item.quantity_on_hand} · Reserved {item.quantity_reserved}
                </span>
                {item.storage_location ? <span>{item.storage_location}</span> : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <InventoryConditionBadge condition={item.condition} />
              {lowStock ? <Badge tone="warning">Low stock</Badge> : null}
            </div>
          </LuxuryCard>
        );
      })}
    </div>
  );
}
