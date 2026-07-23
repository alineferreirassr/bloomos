"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getInventoryItem } from "@/lib/data";
import type { InventoryItem } from "@/types/inventoryItem";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney } from "@/lib/money";
import { InventoryStatusBadge } from "@/modules/inventory/components/InventoryStatusBadge";
import { InventoryConditionBadge } from "@/modules/inventory/components/InventoryConditionBadge";
import { InventoryItemTypeBadge } from "@/modules/inventory/components/InventoryItemTypeBadge";
import { InventoryItemActions } from "@/modules/inventory/components/InventoryItemActions";
import { InventoryTimelineSection } from "@/modules/inventory/components/InventoryTimelineSection";
import { InventoryNotesSection } from "@/modules/inventory/components/InventoryNotesSection";
import { InventoryDocumentsSection } from "@/modules/inventory/components/InventoryDocumentsSection";
import { InventoryMovementActionsSection } from "@/modules/inventory/components/InventoryMovementActionsSection";
import { InventoryMovementHistorySection } from "@/modules/inventory/components/InventoryMovementHistorySection";
import { formatInventoryDate } from "@/modules/inventory/mappers";
import { isInventoryItemLowStock } from "@/modules/inventory/inventoryStats";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "error" } | { status: "ready"; item: InventoryItem };

async function loadInventoryItemDetail(inventoryItemId: string): Promise<LoadState> {
  try {
    const item = await getInventoryItem(inventoryItemId);
    return { status: "ready", item };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function InventoryItemDetailView({ inventoryItemId }: { inventoryItemId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadInventoryItemDetail(inventoryItemId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [inventoryItemId]);

  const refetch = () => {
    loadInventoryItemDetail(inventoryItemId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This inventory item could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this inventory item." onRetry={refetch} />;
  }

  const { item } = state;
  const lowStock = isInventoryItemLowStock(item);
  // InventoryItem has no per-item currency field (unlike Vendor's
  // default_currency) and no workspace-level default currency exists yet
  // either — every money field is formatted in USD until one is added.
  const currency = "USD";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
            {item.name[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-semibold text-text">{item.name}</h2>
              <InventoryStatusBadge status={item.status} />
              <InventoryItemTypeBadge itemType={item.item_type} />
              <InventoryConditionBadge condition={item.condition} />
              {lowStock ? <Badge tone="warning">Low stock</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-text-muted">{item.sku ? `SKU: ${item.sku}` : "No SKU"}</p>
          </div>
        </div>

        <div className="mt-4">
          <InventoryItemActions item={item} onChanged={refetch} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Identity &amp; classification</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Category" value={item.category} />
              <Field label="Subcategory" value={item.subcategory} />
              <Field label="Unit of measure" value={item.unit_of_measure} />
              <Field label="Description" value={item.description} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Quantities</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="On hand" value={String(item.quantity_on_hand)} />
              <Field label="Available" value={String(item.quantity_available)} />
              <Field label="Reserved" value={String(item.quantity_reserved)} />
              <Field label="Reorder level" value={item.reorder_level === null ? null : String(item.reorder_level)} />
              <Field label="Target stock level" value={item.target_stock_level === null ? null : String(item.target_stock_level)} />
            </dl>
            <p className="mt-3 text-xs text-text-muted">
              Quantities change only through recorded stock movements below — they can&rsquo;t be edited directly.
            </p>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Record a movement</h3>
            <div className="mt-3">
              <InventoryMovementActionsSection item={item} onChanged={refetch} />
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Movement history</h3>
            <div className="mt-3">
              <InventoryMovementHistorySection key={item.updated_at} inventoryItemId={item.id} />
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <InventoryNotesSection workspaceId={item.workspace_id} inventoryItemId={item.id} />
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Documents</h3>
            <div className="mt-3">
              <InventoryDocumentsSection inventoryItemId={item.id} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Storage</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3">
              <Field label="Storage location" value={item.storage_location} />
              <Field label="Bin location" value={item.bin_location} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Purchase &amp; value</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3">
              <Field label="Unit cost" value={item.unit_cost === null ? null : formatMoney(item.unit_cost, currency)} />
              <Field label="Replacement cost" value={item.replacement_cost === null ? null : formatMoney(item.replacement_cost, currency)} />
              <Field label="Rental value" value={item.rental_value === null ? null : formatMoney(item.rental_value, currency)} />
              <Field label="Purchase date" value={item.purchase_date === null ? null : formatInventoryDate(item.purchase_date)} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Internal</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <dt className="text-xs text-text-muted">Tags</dt>
                <dd className="mt-1.5">
                  {item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <Badge key={tag} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-text">—</span>
                  )}
                </dd>
              </div>
              <Field label="Notes" value={item.notes} />
              <Field label="Created" value={new Date(item.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(item.updated_at).toLocaleDateString()} />
              {item.archived_at ? <Field label="Archived" value={new Date(item.archived_at).toLocaleDateString()} /> : null}
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
            <div className="mt-3">
              {/* Keyed on updated_at (not just inventoryItemId, which never
                  changes) so editing/archiving/restoring/recording a
                  movement remounts the section and it re-fetches — every one
                  of those mutations bumps updated_at. */}
              <InventoryTimelineSection key={item.updated_at} inventoryItemId={item.id} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
