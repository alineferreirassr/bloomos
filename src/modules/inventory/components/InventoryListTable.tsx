"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InventoryItem } from "@/types/inventoryItem";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
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
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>SKU</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Condition</TableHeaderCell>
            <TableHeaderCell>On hand</TableHeaderCell>
            <TableHeaderCell>Available</TableHeaderCell>
            <TableHeaderCell>Reserved</TableHeaderCell>
            <TableHeaderCell>Location</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const lowStock = isInventoryItemLowStock(item);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <Link href={`/inventory/${item.id}`} className="block max-w-[16rem] truncate text-[15px] font-medium text-text hover:text-accent">
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-text-muted">{item.sku ?? "—"}</TableCell>
                <TableCell className="text-text-muted">{item.category ?? "—"}</TableCell>
                <TableCell className="text-text-muted">{item.item_type === "consumable" ? "Consumable" : "Reusable"}</TableCell>
                <TableCell>
                  <InventoryStatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  <InventoryConditionBadge condition={item.condition} />
                </TableCell>
                <TableCell className="text-text-muted">{item.quantity_on_hand}</TableCell>
                <TableCell>
                  <span className={lowStock ? "font-medium text-amber-700 dark:text-amber-400" : "text-text-muted"}>
                    {item.quantity_available}
                    {lowStock ? (
                      <Badge tone="warning" className="ml-1.5 align-middle">
                        Low stock
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-text-muted">{item.quantity_reserved}</TableCell>
                <TableCell className="text-text-muted">{item.storage_location ?? "—"}</TableCell>
                <TableCell>
                  <ActionMenu actions={actionsFor(item)} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
