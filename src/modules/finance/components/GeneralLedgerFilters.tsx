"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, type AccountType } from "@/core/enums/accountType";

export interface GeneralLedgerFiltersValue {
  startDate: string;
  endDate: string;
  accountId: string;
  accountType: AccountType | "";
  sourceType: string;
}

interface GeneralLedgerFiltersProps {
  value: GeneralLedgerFiltersValue;
  onChange: (value: GeneralLedgerFiltersValue) => void;
  accounts: ChartOfAccount[] | null;
}

/** source_type is free-form (see JournalEntry's own doc comment), matching JournalEntryFilters' identical text-input treatment. */
export function GeneralLedgerFilters({ value, onChange, accounts }: GeneralLedgerFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input
        type="date"
        aria-label="Start date"
        value={value.startDate}
        onChange={(event) => onChange({ ...value, startDate: event.target.value })}
        required
      />
      <Input
        type="date"
        aria-label="End date"
        value={value.endDate}
        onChange={(event) => onChange({ ...value, endDate: event.target.value })}
        required
      />
      <Select
        aria-label="Filter by account"
        value={value.accountId}
        disabled={!accounts}
        onChange={(event) => onChange({ ...value, accountId: event.target.value })}
      >
        <option value="">{accounts ? "All accounts" : "Loading accounts…"}</option>
        {accounts?.map((account) => (
          <option key={account.id} value={account.id}>
            {account.account_number} — {account.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by account type"
        value={value.accountType}
        onChange={(event) => onChange({ ...value, accountType: event.target.value as AccountType | "" })}
      >
        <option value="">All account types</option>
        {ACCOUNT_TYPES.map((type) => (
          <option key={type} value={type}>
            {ACCOUNT_TYPE_LABELS[type]}
          </option>
        ))}
      </Select>
      <Input
        placeholder="Source type, e.g. payment_settlement…"
        aria-label="Filter by source type"
        value={value.sourceType}
        onChange={(event) => onChange({ ...value, sourceType: event.target.value })}
      />
    </div>
  );
}
