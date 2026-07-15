"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUSES, type ExpenseStatus } from "@/core/enums/expenseStatus";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORIES, type ExpenseCategory } from "@/core/enums/expenseCategory";

export interface ExpenseFiltersValue {
  search: string;
  status: ExpenseStatus | "all";
  category: ExpenseCategory | "all";
  dueOnly: boolean;
  unpaidOnly: boolean;
  reimbursableOnly: boolean;
  includeArchived: boolean;
}

export const DEFAULT_EXPENSE_FILTERS: ExpenseFiltersValue = {
  search: "",
  status: "all",
  category: "all",
  dueOnly: false,
  unpaidOnly: false,
  reimbursableOnly: false,
  includeArchived: false,
};

interface ExpenseFiltersProps {
  value: ExpenseFiltersValue;
  onChange: (value: ExpenseFiltersValue) => void;
}

export function ExpenseFilters({ value, onChange }: ExpenseFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="Search description…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search expenses"
        />
        <Select
          aria-label="Filter by category"
          value={value.category}
          onChange={(event) => onChange({ ...value, category: event.target.value as ExpenseCategory | "all" })}
        >
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {EXPENSE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as ExpenseStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {EXPENSE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {EXPENSE_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.dueOnly}
            onChange={(event) => onChange({ ...value, dueOnly: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Due only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.unpaidOnly}
            onChange={(event) => onChange({ ...value, unpaidOnly: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Unpaid only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.reimbursableOnly}
            onChange={(event) => onChange({ ...value, reimbursableOnly: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Reimbursable only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.includeArchived}
            onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Show archived expenses
        </label>
      </div>
    </div>
  );
}
