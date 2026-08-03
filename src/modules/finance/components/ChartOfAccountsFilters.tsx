"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, type AccountType } from "@/core/enums/accountType";

export interface ChartOfAccountsFiltersValue {
  search: string;
  accountType: AccountType | "all";
  includeArchived: boolean;
}

export const DEFAULT_CHART_OF_ACCOUNTS_FILTERS: ChartOfAccountsFiltersValue = {
  search: "",
  accountType: "all",
  includeArchived: false,
};

interface ChartOfAccountsFiltersProps {
  value: ChartOfAccountsFiltersValue;
  onChange: (value: ChartOfAccountsFiltersValue) => void;
}

/** Search is client-side (see ChartOfAccountsView) — listChartOfAccounts has no search parameter, matching a workspace's small, fixed-size Chart of Accounts (~40 rows). */
export function ChartOfAccountsFilters({ value, onChange }: ChartOfAccountsFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder="Search account number or name…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search accounts"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by account type"
        value={value.accountType}
        onChange={(event) => onChange({ ...value, accountType: event.target.value as AccountType | "all" })}
      >
        <option value="all">All account types</option>
        {ACCOUNT_TYPES.map((type) => (
          <option key={type} value={type}>
            {ACCOUNT_TYPE_LABELS[type]}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <Checkbox
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
        />
        Include inactive
      </label>
    </div>
  );
}
