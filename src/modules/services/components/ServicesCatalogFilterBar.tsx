"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { SERVICE_STATUSES, SERVICE_STATUS_LABELS, type ServiceStatus } from "@/core/enums/serviceStatus";
import type { ServiceCategory } from "@/types/serviceCategory";

export type HealthFilterValue = "all" | "needsAttention" | "healthy";
export type UsageFilterValue = "all" | "assigned" | "unassigned";

export interface ServicesCatalogFilterBarValue {
  search: string;
  status: ServiceStatus | "all";
  categoryId: string | "all";
  health: HealthFilterValue;
  usage: UsageFilterValue;
  includeArchived: boolean;
}

export const DEFAULT_SERVICES_CATALOG_FILTERS: ServicesCatalogFilterBarValue = {
  search: "",
  status: "all",
  categoryId: "all",
  health: "all",
  usage: "all",
  includeArchived: false,
};

/** True if any filter has moved away from its default — used to distinguish "the catalog is genuinely empty" from "no Service matches these filters." */
export function hasActiveServicesCatalogFilters(value: ServicesCatalogFilterBarValue): boolean {
  return (
    value.search.trim() !== "" ||
    value.status !== "all" ||
    value.categoryId !== "all" ||
    value.health !== "all" ||
    value.usage !== "all" ||
    value.includeArchived
  );
}

interface ServicesCatalogFilterBarProps {
  value: ServicesCatalogFilterBarValue;
  onChange: (value: ServicesCatalogFilterBarValue) => void;
  categories: ServiceCategory[];
}

/** Fully controlled from the parent — every field calls `onChange` immediately, same shape as InventoryFilters/PurchaseFilters. Selecting "Archived" under Status alone would show nothing unless `includeArchived` is also set (the repository excludes archived rows by default regardless of the status filter), so the archived checkbox stays a separate, explicit control rather than being implied. */
export function ServicesCatalogFilterBar({ value, onChange, categories }: ServicesCatalogFilterBarProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Input
        placeholder="Search Services…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search Services"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as ServiceStatus | "all" })}
      >
        <option value="all">All statuses</option>
        {SERVICE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {SERVICE_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by category"
        value={value.categoryId}
        onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
      >
        <option value="all">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by health"
        value={value.health}
        onChange={(event) => onChange({ ...value, health: event.target.value as HealthFilterValue })}
      >
        <option value="all">All health</option>
        <option value="needsAttention">Needs attention</option>
        <option value="healthy">Healthy</option>
      </Select>
      <Select
        aria-label="Filter by assignment"
        value={value.usage}
        onChange={(event) => onChange({ ...value, usage: event.target.value as UsageFilterValue })}
      >
        <option value="all">Assigned + Not assigned</option>
        <option value="assigned">Assigned</option>
        <option value="unassigned">Not assigned</option>
      </Select>
      <label className="flex items-center gap-2 text-sm text-text-muted lg:col-span-6">
        <Checkbox
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
        />
        Show archived Services
      </label>
    </div>
  );
}
