"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUSES, type PurchaseStatus } from "@/core/enums/purchaseStatus";

export interface PurchaseFiltersValue {
  search: string;
  status: PurchaseStatus | "all";
  includeArchived: boolean;
  /** Not passed to listPurchases — the List view special-cases these into getOpenPurchases()/getOverduePurchases() calls instead, since PurchaseFilters (repository-level) has no matching fields. */
  openOnly: boolean;
  overdueOnly: boolean;
}

export const DEFAULT_PURCHASE_FILTERS: PurchaseFiltersValue = {
  search: "",
  status: "all",
  includeArchived: false,
  openOnly: false,
  overdueOnly: false,
};

interface PurchaseFiltersProps {
  value: PurchaseFiltersValue;
  onChange: (value: PurchaseFiltersValue) => void;
}

export function PurchaseFilters({ value, onChange }: PurchaseFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder="Search purchase number, vendor reference, notes…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search purchases"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as PurchaseStatus | "all" })}
      >
        <option value="all">All statuses</option>
        {PURCHASE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PURCHASE_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.openOnly}
            onChange={(event) => onChange({ ...value, openOnly: event.target.checked, overdueOnly: false })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Open only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.overdueOnly}
            onChange={(event) => onChange({ ...value, overdueOnly: event.target.checked, openOnly: false })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Overdue only
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-muted lg:col-span-4">
        <input
          type="checkbox"
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        Show archived purchases
      </label>
    </div>
  );
}
