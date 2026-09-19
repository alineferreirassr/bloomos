"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";

export interface TrialBalanceFiltersValue {
  asOfDate: string;
  includeZeroBalances: boolean;
}

interface TrialBalanceFiltersProps {
  value: TrialBalanceFiltersValue;
  onChange: (value: TrialBalanceFiltersValue) => void;
}

export function TrialBalanceFilters({ value, onChange }: TrialBalanceFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border/50 bg-surface/70 p-5">
      <div className="max-w-xs">
        <Input
          type="date"
          aria-label="As-of date"
          value={value.asOfDate}
          onChange={(event) => onChange({ ...value, asOfDate: event.target.value })}
          required
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-text-muted">
        <Checkbox
          checked={value.includeZeroBalances}
          onChange={(event) => onChange({ ...value, includeZeroBalances: event.target.checked })}
        />
        Include zero balances
      </label>
    </div>
  );
}
