"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { VENDOR_STATUS_LABELS, VENDOR_STATUSES, type VendorStatus } from "@/core/enums/vendorStatus";
import type { VendorSort } from "@/lib/data/vendors/repository";

export type VendorSortField = NonNullable<VendorSort["sortBy"]>;
export type VendorSortDirection = NonNullable<VendorSort["sortDirection"]>;

export interface VendorFiltersValue {
  search: string;
  status: VendorStatus | "all";
  preferredOnly: boolean;
  tag: string;
  includeArchived: boolean;
  sortBy: VendorSortField;
  sortDirection: VendorSortDirection;
}

export const DEFAULT_VENDOR_FILTERS: VendorFiltersValue = {
  search: "",
  status: "all",
  preferredOnly: false,
  tag: "",
  includeArchived: false,
  sortBy: "created_at",
  sortDirection: "desc",
};

interface VendorFiltersProps {
  value: VendorFiltersValue;
  onChange: (value: VendorFiltersValue) => void;
}

export function VendorFilters({ value, onChange }: VendorFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Input
        placeholder="Search company, contact, email, phone, tax ID…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search vendors"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as VendorStatus | "all" })}
      >
        <option value="all">All statuses</option>
        {VENDOR_STATUSES.map((status) => (
          <option key={status} value={status}>
            {VENDOR_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Input
        placeholder="Filter by tag…"
        value={value.tag}
        onChange={(event) => onChange({ ...value, tag: event.target.value })}
        aria-label="Filter by tag"
      />
      <Select
        aria-label="Sort by"
        value={`${value.sortBy}:${value.sortDirection}`}
        onChange={(event) => {
          const [sortBy, sortDirection] = event.target.value.split(":") as [VendorSortField, VendorSortDirection];
          onChange({ ...value, sortBy, sortDirection });
        }}
      >
        <option value="created_at:desc">Created: newest first</option>
        <option value="created_at:asc">Created: oldest first</option>
        <option value="updated_at:desc">Updated: newest first</option>
        <option value="updated_at:asc">Updated: oldest first</option>
        <option value="company_name:asc">Company name: A–Z</option>
        <option value="company_name:desc">Company name: Z–A</option>
        <option value="display_name:asc">Display name: A–Z</option>
        <option value="display_name:desc">Display name: Z–A</option>
        <option value="is_preferred:desc">Preferred first</option>
      </Select>
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={value.preferredOnly}
          onChange={(event) => onChange({ ...value, preferredOnly: event.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        Preferred only
      </label>
      <label className="flex items-center gap-2 text-sm text-text-muted lg:col-span-6">
        <input
          type="checkbox"
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        Show archived vendors
      </label>
    </div>
  );
}
