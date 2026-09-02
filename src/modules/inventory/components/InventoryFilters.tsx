"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { INVENTORY_STATUS_LABELS, INVENTORY_STATUSES, type InventoryStatus } from "@/core/enums/inventoryStatus";
import { INVENTORY_ITEM_TYPE_LABELS, INVENTORY_ITEM_TYPES, type InventoryItemType } from "@/core/enums/inventoryItemType";
import { INVENTORY_CONDITION_LABELS, INVENTORY_CONDITIONS, type InventoryCondition } from "@/core/enums/inventoryCondition";

export interface InventoryFiltersValue {
  search: string;
  status: InventoryStatus | "all";
  itemType: InventoryItemType | "all";
  condition: InventoryCondition | "all";
  includeArchived: boolean;
}

export const DEFAULT_INVENTORY_FILTERS: InventoryFiltersValue = {
  search: "",
  status: "all",
  itemType: "all",
  condition: "all",
  includeArchived: false,
};

interface InventoryFiltersProps {
  value: InventoryFiltersValue;
  onChange: (value: InventoryFiltersValue) => void;
}

export function InventoryFilters({ value, onChange }: InventoryFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl bg-surface/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Input
        placeholder="Search name, SKU, category, tags…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search inventory"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as InventoryStatus | "all" })}
      >
        <option value="all">All statuses</option>
        {INVENTORY_STATUSES.map((status) => (
          <option key={status} value={status}>
            {INVENTORY_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by item type"
        value={value.itemType}
        onChange={(event) => onChange({ ...value, itemType: event.target.value as InventoryItemType | "all" })}
      >
        <option value="all">All item types</option>
        {INVENTORY_ITEM_TYPES.map((itemType) => (
          <option key={itemType} value={itemType}>
            {INVENTORY_ITEM_TYPE_LABELS[itemType]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by condition"
        value={value.condition}
        onChange={(event) => onChange({ ...value, condition: event.target.value as InventoryCondition | "all" })}
      >
        <option value="all">All conditions</option>
        {INVENTORY_CONDITIONS.map((condition) => (
          <option key={condition} value={condition}>
            {INVENTORY_CONDITION_LABELS[condition]}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 text-sm text-text-muted lg:col-span-5">
        <Checkbox
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
        />
        Show archived items
      </label>
    </div>
  );
}
