"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { LEAD_STATUS_LABELS, LEAD_STATUSES, type LeadStatus } from "@/core/enums/leadStatus";
import { LEAD_SOURCES, EVENT_TYPES } from "@/modules/leads/constants";

export interface LeadFiltersValue {
  search: string;
  status: LeadStatus | "all";
  source: string;
  eventType: string;
  includeArchived: boolean;
}

interface LeadFiltersProps {
  value: LeadFiltersValue;
  onChange: (value: LeadFiltersValue) => void;
}

export function LeadFilters({ value, onChange }: LeadFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input
        placeholder="Search name or email…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search leads"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(event) =>
          onChange({ ...value, status: event.target.value as LeadStatus | "all" })
        }
      >
        <option value="all">All statuses</option>
        {LEAD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {LEAD_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by source"
        value={value.source}
        onChange={(event) => onChange({ ...value, source: event.target.value })}
      >
        <option value="all">All sources</option>
        {LEAD_SOURCES.map((source) => (
          <option key={source} value={source}>
            {source}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by event type"
        value={value.eventType}
        onChange={(event) => onChange({ ...value, eventType: event.target.value })}
      >
        <option value="all">All event types</option>
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 text-sm text-text-muted lg:col-span-5">
        <Checkbox
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
        />
        Show archived leads
      </label>
    </div>
  );
}
