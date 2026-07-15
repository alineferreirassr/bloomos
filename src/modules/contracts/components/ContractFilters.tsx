"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES, type ContractStatus } from "@/core/enums/contractStatus";
import {
  SIGNATURE_STATUS_LABELS,
  SIGNATURE_STATUSES,
  type SignatureStatus,
} from "@/core/enums/signatureStatus";
import {
  CONTRACT_TEMPLATE_CATEGORY_LABELS,
  CONTRACT_TEMPLATE_CATEGORIES,
  type ContractTemplateCategory,
} from "@/core/enums/contractTemplateCategory";

export type ContractSortField = "updated" | "effective" | "expiration" | "value";
export type ContractSortDirection = "asc" | "desc";

export interface ContractFiltersValue {
  search: string;
  status: ContractStatus | "all";
  signatureStatus: SignatureStatus | "all";
  templateCategory: ContractTemplateCategory | "all";
  effectiveDateFrom: string;
  effectiveDateTo: string;
  includeArchived: boolean;
  sortField: ContractSortField;
  sortDirection: ContractSortDirection;
}

export const DEFAULT_CONTRACT_FILTERS: ContractFiltersValue = {
  search: "",
  status: "all",
  signatureStatus: "all",
  templateCategory: "all",
  effectiveDateFrom: "",
  effectiveDateTo: "",
  includeArchived: false,
  sortField: "updated",
  sortDirection: "desc",
};

interface ContractFiltersProps {
  value: ContractFiltersValue;
  onChange: (value: ContractFiltersValue) => void;
}

export function ContractFilters({ value, onChange }: ContractFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search number, title, client, event…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search contracts"
          className="lg:col-span-2"
        />
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as ContractStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {CONTRACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CONTRACT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by signature status"
          value={value.signatureStatus}
          onChange={(event) =>
            onChange({ ...value, signatureStatus: event.target.value as SignatureStatus | "all" })
          }
        >
          <option value="all">All signature statuses</option>
          {SIGNATURE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SIGNATURE_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Filter by template category"
          value={value.templateCategory}
          onChange={(event) =>
            onChange({ ...value, templateCategory: event.target.value as ContractTemplateCategory | "all" })
          }
        >
          <option value="all">All template categories</option>
          {CONTRACT_TEMPLATE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CONTRACT_TEMPLATE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="Effective date from"
          value={value.effectiveDateFrom}
          onChange={(event) => onChange({ ...value, effectiveDateFrom: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Effective date to"
          value={value.effectiveDateTo}
          onChange={(event) => onChange({ ...value, effectiveDateTo: event.target.value })}
        />
        <Select
          aria-label="Sort by"
          value={`${value.sortField}:${value.sortDirection}`}
          onChange={(event) => {
            const [sortField, sortDirection] = event.target.value.split(":") as [
              ContractSortField,
              ContractSortDirection,
            ];
            onChange({ ...value, sortField, sortDirection });
          }}
        >
          <option value="updated:desc">Updated: newest first</option>
          <option value="updated:asc">Updated: oldest first</option>
          <option value="effective:asc">Effective date: earliest first</option>
          <option value="effective:desc">Effective date: latest first</option>
          <option value="expiration:asc">Expiration date: earliest first</option>
          <option value="expiration:desc">Expiration date: latest first</option>
          <option value="value:desc">Total value: highest first</option>
          <option value="value:asc">Total value: lowest first</option>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        Show archived contracts
      </label>
    </div>
  );
}
