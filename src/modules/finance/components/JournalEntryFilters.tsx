"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { POSTING_STATUS_LABELS, POSTING_STATUSES, type PostingStatus } from "@/core/enums/postingStatus";

/** source_type is free-form (a polymorphic string, not a strict enum — see JournalEntry's own doc comment), so its filter is a plain text field rather than a Select. */
export interface JournalEntryFiltersValue {
  dateFrom: string;
  dateTo: string;
  sourceType: string;
  postingStatus: PostingStatus | "all";
}

export const DEFAULT_JOURNAL_ENTRY_FILTERS: JournalEntryFiltersValue = {
  dateFrom: "",
  dateTo: "",
  sourceType: "",
  postingStatus: "all",
};

interface JournalEntryFiltersProps {
  value: JournalEntryFiltersValue;
  onChange: (value: JournalEntryFiltersValue) => void;
}

export function JournalEntryFilters({ value, onChange }: JournalEntryFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        type="date"
        aria-label="Date from"
        value={value.dateFrom}
        onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
      />
      <Input
        type="date"
        aria-label="Date to"
        value={value.dateTo}
        onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
      />
      <Input
        placeholder="Source type, e.g. payment_settlement…"
        aria-label="Filter by source type"
        value={value.sourceType}
        onChange={(event) => onChange({ ...value, sourceType: event.target.value })}
      />
      <Select
        aria-label="Filter by posting status"
        value={value.postingStatus}
        onChange={(event) => onChange({ ...value, postingStatus: event.target.value as PostingStatus | "all" })}
      >
        <option value="all">All posting statuses</option>
        {POSTING_STATUSES.map((status) => (
          <option key={status} value={status}>
            {POSTING_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
    </div>
  );
}
