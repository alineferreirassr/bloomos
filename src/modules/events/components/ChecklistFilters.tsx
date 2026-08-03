"use client";

import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { CHECKLIST_CATEGORY_LABELS, CHECKLIST_CATEGORIES, type ChecklistCategory } from "@/core/enums/checklistCategory";
import { CHECKLIST_STATUS_LABELS, CHECKLIST_STATUSES, type ChecklistStatus } from "@/core/enums/checklistStatus";
import { NOTE_PRIORITY_LABELS, NOTE_PRIORITIES, type NotePriority } from "@/core/enums/notePriority";
import { ASSIGNED_TYPE_LABELS, ASSIGNED_TYPES, type AssignedType } from "@/core/enums/assignedType";

export interface ChecklistFiltersValue {
  search: string;
  category: ChecklistCategory | "all";
  status: ChecklistStatus | "all";
  priority: NotePriority | "all";
  assignedType: AssignedType | "all";
  overdueOnly: boolean;
  showCompleted: boolean;
  groupByCategory: boolean;
}

export const DEFAULT_CHECKLIST_FILTERS: ChecklistFiltersValue = {
  search: "",
  category: "all",
  status: "all",
  priority: "all",
  assignedType: "all",
  overdueOnly: false,
  showCompleted: true,
  groupByCategory: true,
};

interface ChecklistFiltersProps {
  value: ChecklistFiltersValue;
  onChange: (value: ChecklistFiltersValue) => void;
}

export function ChecklistFilters({ value, onChange }: ChecklistFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search title, description…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search checklist items"
          className="lg:col-span-2"
        />
        <Select
          aria-label="Filter by category"
          value={value.category}
          onChange={(event) => onChange({ ...value, category: event.target.value as ChecklistCategory | "all" })}
        >
          <option value="all">All categories</option>
          {CHECKLIST_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CHECKLIST_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as ChecklistStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {CHECKLIST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CHECKLIST_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Filter by priority"
          value={value.priority}
          onChange={(event) => onChange({ ...value, priority: event.target.value as NotePriority | "all" })}
        >
          <option value="all">All priorities</option>
          {NOTE_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {NOTE_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by assignment"
          value={value.assignedType}
          onChange={(event) => onChange({ ...value, assignedType: event.target.value as AssignedType | "all" })}
        >
          <option value="all">All assignments</option>
          {ASSIGNED_TYPES.map((type) => (
            <option key={type} value={type}>
              {ASSIGNED_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox
            checked={value.overdueOnly}
            onChange={(event) => onChange({ ...value, overdueOnly: event.target.checked })}
          />
          Overdue only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox
            checked={value.showCompleted}
            onChange={(event) => onChange({ ...value, showCompleted: event.target.checked })}
          />
          Show completed
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <Checkbox
            checked={value.groupByCategory}
            onChange={(event) => onChange({ ...value, groupByCategory: event.target.checked })}
          />
          Group by category
        </label>
      </div>
    </div>
  );
}
