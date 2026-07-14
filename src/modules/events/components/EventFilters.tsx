"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EVENT_STATUS_LABELS, EVENT_STATUSES, type EventStatus } from "@/core/enums/eventStatus";
import {
  EVENT_LIFECYCLE_STAGE_LABELS,
  EVENT_LIFECYCLE_STAGES,
  type EventLifecycleStage,
} from "@/core/enums/eventLifecycleStage";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventType } from "@/core/enums/eventType";
import { EVENT_PRIORITY_LABELS, EVENT_PRIORITIES, type EventPriority } from "@/core/enums/eventPriority";

export type EventSortDirection = "asc" | "desc";

export interface EventFiltersValue {
  search: string;
  status: EventStatus | "all";
  lifecycleStage: EventLifecycleStage | "all";
  eventType: EventType | "all";
  priority: EventPriority | "all";
  dateFrom: string;
  dateTo: string;
  includeArchived: boolean;
  sortDirection: EventSortDirection;
}

interface EventFiltersProps {
  value: EventFiltersValue;
  onChange: (value: EventFiltersValue) => void;
}

export function EventFilters({ value, onChange }: EventFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search title, client, location…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search events"
          className="lg:col-span-2"
        />
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as EventStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {EVENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {EVENT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by lifecycle stage"
          value={value.lifecycleStage}
          onChange={(event) =>
            onChange({ ...value, lifecycleStage: event.target.value as EventLifecycleStage | "all" })
          }
        >
          <option value="all">All lifecycle stages</option>
          {EVENT_LIFECYCLE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {EVENT_LIFECYCLE_STAGE_LABELS[stage]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Filter by event type"
          value={value.eventType}
          onChange={(event) => onChange({ ...value, eventType: event.target.value as EventType | "all" })}
        >
          <option value="all">All event types</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by priority"
          value={value.priority}
          onChange={(event) => onChange({ ...value, priority: event.target.value as EventPriority | "all" })}
        >
          <option value="all">All priorities</option>
          {EVENT_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {EVENT_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="From date"
          value={value.dateFrom}
          onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
        />
        <Input
          type="date"
          aria-label="To date"
          value={value.dateTo}
          onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.includeArchived}
            onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Show archived events
        </label>
        <Select
          aria-label="Sort by event date"
          value={value.sortDirection}
          onChange={(event) =>
            onChange({ ...value, sortDirection: event.target.value as EventSortDirection })
          }
          className="w-auto"
        >
          <option value="asc">Event date: earliest first</option>
          <option value="desc">Event date: latest first</option>
        </Select>
      </div>
    </div>
  );
}
