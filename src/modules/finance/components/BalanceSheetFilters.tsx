"use client";

import { Input } from "@/components/ui/Input";

export interface BalanceSheetFiltersValue {
  asOfDate: string;
}

interface BalanceSheetFiltersProps {
  value: BalanceSheetFiltersValue;
  onChange: (value: BalanceSheetFiltersValue) => void;
}

export function BalanceSheetFilters({ value, onChange }: BalanceSheetFiltersProps) {
  return (
    <div className="max-w-xs">
      <Input
        type="date"
        aria-label="As-of date"
        value={value.asOfDate}
        onChange={(event) => onChange({ asOfDate: event.target.value })}
        required
      />
    </div>
  );
}
