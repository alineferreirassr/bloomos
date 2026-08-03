"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { EVENT_SERVICE_STATUSES, EVENT_SERVICE_STATUS_LABELS, type EventServiceStatus } from "@/core/enums/eventServiceStatus";
import type { AssignmentFiltersValue, AssignmentTeamFilter } from "@/modules/services/assignmentFiltering";

interface AssignmentsFiltersProps {
  value: AssignmentFiltersValue;
  onChange: (value: AssignmentFiltersValue) => void;
  /** Distinct version numbers actually present among the fetched rows — never a separate query, just `Array.from(new Set(...))` over data the page already has. */
  availableVersionNumbers: number[];
}

const TEAM_FILTER_LABELS: Record<AssignmentTeamFilter, string> = {
  all: "Any team status",
  fully_assigned: "Fully assigned",
  needs_assignment: "Needs assignment",
};

/** "Upcoming only"/"Past only" are mutually exclusive, same pattern as Purchases' openOnly/overdueOnly — checking one clears the other; unchecking either returns to "all". */
export function AssignmentsFilters({ value, onChange, availableVersionNumbers }: AssignmentsFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder="Search event or client…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search assignments"
        className="lg:col-span-2"
      />
      <Select aria-label="Filter by status" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as EventServiceStatus | "all" })}>
        <option value="all">All statuses</option>
        {EVENT_SERVICE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {EVENT_SERVICE_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by assigned version"
        value={value.versionNumber === "all" ? "all" : String(value.versionNumber)}
        onChange={(event) => onChange({ ...value, versionNumber: event.target.value === "all" ? "all" : Number(event.target.value) })}
      >
        <option value="all">All versions</option>
        {availableVersionNumbers.map((versionNumber) => (
          <option key={versionNumber} value={versionNumber}>
            Version {versionNumber}
          </option>
        ))}
      </Select>
      <Select aria-label="Filter by team status" value={value.team} onChange={(event) => onChange({ ...value, team: event.target.value as AssignmentTeamFilter })}>
        {(Object.keys(TEAM_FILTER_LABELS) as AssignmentTeamFilter[]).map((team) => (
          <option key={team} value={team}>
            {TEAM_FILTER_LABELS[team]}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-4 lg:col-span-4">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox checked={value.timing === "upcoming"} onChange={(event) => onChange({ ...value, timing: event.target.checked ? "upcoming" : "all" })} />
          Upcoming only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox checked={value.timing === "past"} onChange={(event) => onChange({ ...value, timing: event.target.checked ? "past" : "all" })} />
          Past only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox checked={value.includeArchived} onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })} />
          Show archived events
        </label>
      </div>
    </div>
  );
}
