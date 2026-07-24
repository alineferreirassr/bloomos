"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/core/enums/eventType";
import { EVENT_PRIORITIES, EVENT_PRIORITY_LABELS } from "@/core/enums/eventPriority";
import type { OperationalPipelineFilterValues } from "@/modules/pipeline/operationalLogic";
import type { EventHealthStatus } from "@/core/workflows/eventHealth";

interface OperationalPipelineFiltersProps {
  value: OperationalPipelineFilterValues;
  onChange: (value: OperationalPipelineFilterValues) => void;
  owners: string[];
}

const HEALTH_STATUS_OPTIONS: { value: EventHealthStatus; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "waiting", label: "Needs attention" },
  { value: "blocked", label: "Blocked" },
];

/**
 * Distinct from EventFilters (the /events list page's own filter bar) —
 * this board needs owner/health/overdue/upcoming filtering that isn't part
 * of the shared EventFilters repository contract, and its stage grouping is
 * already the board's own column layout, not a filter. All filtering here
 * happens client-side over the already-loaded, already-aggregated card list.
 */
export function OperationalPipelineFilters({ value, onChange, owners }: OperationalPipelineFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search event or client…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search events"
        />
        <Select
          aria-label="Filter by event type"
          value={value.eventType}
          onChange={(event) => onChange({ ...value, eventType: event.target.value as OperationalPipelineFilterValues["eventType"] })}
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
          onChange={(event) => onChange({ ...value, priority: event.target.value as OperationalPipelineFilterValues["priority"] })}
        >
          <option value="all">All priorities</option>
          {EVENT_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {EVENT_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by owner"
          value={value.owner}
          onChange={(event) => onChange({ ...value, owner: event.target.value as OperationalPipelineFilterValues["owner"] })}
        >
          <option value="all">All owners</option>
          <option value="unassigned">Unassigned</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Select
          aria-label="Filter by health"
          value={value.healthStatus}
          onChange={(event) => onChange({ ...value, healthStatus: event.target.value as OperationalPipelineFilterValues["healthStatus"] })}
        >
          <option value="all">All health states</option>
          {HEALTH_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.overdueOnly}
            onChange={(event) => onChange({ ...value, overdueOnly: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Overdue checklist only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.upcomingOnly}
            onChange={(event) => onChange({ ...value, upcomingOnly: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Upcoming (next 7 days) only
        </label>
      </div>
    </div>
  );
}
