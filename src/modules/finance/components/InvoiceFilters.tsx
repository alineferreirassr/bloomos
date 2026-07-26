"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { INVOICE_STATUS_LABELS, INVOICE_STATUSES, type InvoiceStatus } from "@/core/enums/invoiceStatus";

export type InvoiceSortField = "due" | "issue" | "balance" | "total" | "updated";
export type InvoiceSortDirection = "asc" | "desc";

export interface InvoiceFiltersValue {
  search: string;
  status: InvoiceStatus | "all";
  issueDateFrom: string;
  issueDateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
  overdueOnly: boolean;
  includeArchived: boolean;
  sortField: InvoiceSortField;
  sortDirection: InvoiceSortDirection;
}

export const DEFAULT_INVOICE_FILTERS: InvoiceFiltersValue = {
  search: "",
  status: "all",
  issueDateFrom: "",
  issueDateTo: "",
  dueDateFrom: "",
  dueDateTo: "",
  overdueOnly: false,
  includeArchived: false,
  sortField: "updated",
  sortDirection: "desc",
};

interface InvoiceFiltersProps {
  value: InvoiceFiltersValue;
  onChange: (value: InvoiceFiltersValue) => void;
}

export function InvoiceFilters({ value, onChange }: InvoiceFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search number, title, client, event, contract…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search invoices"
          className="lg:col-span-2"
        />
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as InvoiceStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {INVOICE_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort by"
          value={`${value.sortField}:${value.sortDirection}`}
          onChange={(event) => {
            const [sortField, sortDirection] = event.target.value.split(":") as [
              InvoiceSortField,
              InvoiceSortDirection,
            ];
            onChange({ ...value, sortField, sortDirection });
          }}
        >
          <option value="updated:desc">Updated: newest first</option>
          <option value="updated:asc">Updated: oldest first</option>
          <option value="due:asc">Due date: earliest first</option>
          <option value="due:desc">Due date: latest first</option>
          <option value="issue:asc">Issue date: earliest first</option>
          <option value="issue:desc">Issue date: latest first</option>
          <option value="balance:desc">Balance: highest first</option>
          <option value="balance:asc">Balance: lowest first</option>
          <option value="total:desc">Total: highest first</option>
          <option value="total:asc">Total: lowest first</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="date"
          aria-label="Issue date from"
          value={value.issueDateFrom}
          onChange={(event) => onChange({ ...value, issueDateFrom: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Issue date to"
          value={value.issueDateTo}
          onChange={(event) => onChange({ ...value, issueDateTo: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Due date from"
          value={value.dueDateFrom}
          onChange={(event) => onChange({ ...value, dueDateFrom: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Due date to"
          value={value.dueDateTo}
          onChange={(event) => onChange({ ...value, dueDateTo: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox
            checked={value.overdueOnly}
            onChange={(event) => onChange({ ...value, overdueOnly: event.target.checked })}
          />
          Overdue only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox
            checked={value.includeArchived}
            onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
          />
          Show archived invoices
        </label>
      </div>
    </div>
  );
}
