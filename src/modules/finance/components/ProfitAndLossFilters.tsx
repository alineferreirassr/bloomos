"use client";

import { Input } from "@/components/ui/Input";

export interface ProfitAndLossFiltersValue {
  startDate: string;
  endDate: string;
  compareEnabled: boolean;
  comparisonStartDate: string;
  comparisonEndDate: string;
}

interface ProfitAndLossFiltersProps {
  value: ProfitAndLossFiltersValue;
  onChange: (value: ProfitAndLossFiltersValue) => void;
}

export function ProfitAndLossFilters({ value, onChange }: ProfitAndLossFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={value.compareEnabled}
          onChange={(event) => onChange({ ...value, compareEnabled: event.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        Compare to another period
      </label>
      {value.compareEnabled ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="date"
            aria-label="Comparison start date"
            value={value.comparisonStartDate}
            onChange={(event) => onChange({ ...value, comparisonStartDate: event.target.value })}
            required
          />
          <Input
            type="date"
            aria-label="Comparison end date"
            value={value.comparisonEndDate}
            onChange={(event) => onChange({ ...value, comparisonEndDate: event.target.value })}
            required
          />
        </div>
      ) : null}
    </div>
  );
}
