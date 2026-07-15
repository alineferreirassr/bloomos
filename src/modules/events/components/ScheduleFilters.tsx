"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SCHEDULE_CATEGORY_LABELS, SCHEDULE_CATEGORIES, type ScheduleCategory } from "@/core/enums/scheduleCategory";
import { SCHEDULE_STATUS_LABELS, SCHEDULE_STATUSES, type ScheduleStatus } from "@/core/enums/scheduleStatus";

export interface ScheduleFiltersValue {
  search: string;
  category: ScheduleCategory | "all";
  status: ScheduleStatus | "all";
  /** "all", "unassigned", or an exact assigned_to value drawn from assignedOptions. */
  assignedTo: string;
  delayedOnly: boolean;
  showCompleted: boolean;
}

export const DEFAULT_SCHEDULE_FILTERS: ScheduleFiltersValue = {
  search: "",
  category: "all",
  status: "all",
  assignedTo: "all",
  delayedOnly: false,
  showCompleted: true,
};

interface ScheduleFiltersProps {
  value: ScheduleFiltersValue;
  onChange: (value: ScheduleFiltersValue) => void;
  /** Distinct non-null assigned_to values present on this event's schedule, for the assignment dropdown. */
  assignedOptions: string[];
}

export function ScheduleFilters({ value, onChange, assignedOptions }: ScheduleFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search title, description…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search schedule items"
          className="lg:col-span-2"
        />
        <Select
          aria-label="Filter by category"
          value={value.category}
          onChange={(event) => onChange({ ...value, category: event.target.value as ScheduleCategory | "all" })}
        >
          <option value="all">All categories</option>
          {SCHEDULE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {SCHEDULE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as ScheduleStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {SCHEDULE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SCHEDULE_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Filter by assigned person"
          value={value.assignedTo}
          onChange={(event) => onChange({ ...value, assignedTo: event.target.value })}
        >
          <option value="all">All assignments</option>
          <option value="unassigned">Unassigned</option>
          {assignedOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.delayedOnly}
            onChange={(event) => onChange({ ...value, delayedOnly: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Delayed only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.showCompleted}
            onChange={(event) => onChange({ ...value, showCompleted: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Show completed
        </label>
      </div>
    </div>
  );
}
