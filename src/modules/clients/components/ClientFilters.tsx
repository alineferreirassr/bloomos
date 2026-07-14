"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CLIENT_STATUS_LABELS, CLIENT_STATUSES, type ClientStatus } from "@/core/enums/clientStatus";
import { CLIENT_SOURCES } from "@/modules/clients/constants";

export interface ClientFiltersValue {
  search: string;
  status: ClientStatus | "all";
  source: string;
  tag: string;
  vipOnly: boolean;
  includeArchived: boolean;
}

interface ClientFiltersProps {
  value: ClientFiltersValue;
  onChange: (value: ClientFiltersValue) => void;
}

export function ClientFilters({ value, onChange }: ClientFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Input
        placeholder="Search name, email, phone, partner…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search clients"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by status"
        value={value.status}
        onChange={(event) => onChange({ ...value, status: event.target.value as ClientStatus | "all" })}
      >
        <option value="all">All statuses</option>
        {CLIENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {CLIENT_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by source"
        value={value.source}
        onChange={(event) => onChange({ ...value, source: event.target.value })}
      >
        <option value="all">All sources</option>
        {CLIENT_SOURCES.map((source) => (
          <option key={source} value={source}>
            {source}
          </option>
        ))}
      </Select>
      <Input
        placeholder="Filter by tag…"
        value={value.tag}
        onChange={(event) => onChange({ ...value, tag: event.target.value })}
        aria-label="Filter by tag"
      />
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={value.vipOnly}
          onChange={(event) => onChange({ ...value, vipOnly: event.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        VIP only
      </label>
      <label className="flex items-center gap-2 text-sm text-text-muted lg:col-span-6">
        <input
          type="checkbox"
          checked={value.includeArchived}
          onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
        />
        Show archived clients
      </label>
    </div>
  );
}
