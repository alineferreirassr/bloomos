"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
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

/** True when any filter behind the "More filters" disclosure is set to something other than its default — used to open the disclosure automatically so an active filter is never silently hidden. */
function hasActiveSecondaryFilters(value: EventFiltersValue): boolean {
  return (
    value.eventType !== "all" ||
    value.priority !== "all" ||
    value.dateFrom !== "" ||
    value.dateTo !== "" ||
    value.includeArchived ||
    value.sortDirection !== "asc"
  );
}

/**
 * GLOBAL-VISUAL-02C.1 — search + the two most-used filters (status,
 * lifecycle stage) stay always visible; event type/priority/date range/
 * archived/sort move behind a "More filters" disclosure (opens
 * automatically if one of them is already active), so the control surface
 * reads as a compact search bar with options rather than one large,
 * permanently-open form. Every field, value, and onChange call is
 * unchanged — presentation only.
 */
export function EventFilters({ value, onChange }: EventFiltersProps) {
  const [expanded, setExpanded] = useState(() => hasActiveSecondaryFilters(value));

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-surface/70 p-4">
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

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors duration-150 hover:text-accent"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {expanded ? "Fewer filters" : "More filters"}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border/40 pt-3">
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
              <Checkbox
                checked={value.includeArchived}
                onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
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
      ) : null}
    </div>
  );
}
