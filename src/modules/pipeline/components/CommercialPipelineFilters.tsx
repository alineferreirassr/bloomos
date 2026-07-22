"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { CommercialPipelineFilterValues } from "@/modules/pipeline/logic";

interface CommercialPipelineFiltersProps {
  value: CommercialPipelineFilterValues;
  onChange: (value: CommercialPipelineFilterValues) => void;
  assignees: string[];
}

/**
 * Distinct from LeadFilters — this board needs assignee/budget/date-range
 * filtering that isn't part of the shared LeadFilters repository contract,
 * and its status/source/eventType filters don't apply to a board that must
 * show every working status across all its columns simultaneously. All
 * filtering here happens client-side over the already-loaded Lead list.
 */
export function CommercialPipelineFilters({ value, onChange, assignees }: CommercialPipelineFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input
        placeholder="Search name, email, event type…"
        value={value.search}
        onChange={(event) => onChange({ ...value, search: event.target.value })}
        aria-label="Search leads"
        className="lg:col-span-2"
      />
      <Select
        aria-label="Filter by assigned team member"
        value={value.assignedTo}
        onChange={(event) => onChange({ ...value, assignedTo: event.target.value })}
      >
        <option value="all">All assignees</option>
        {assignees.map((assignee) => (
          <option key={assignee} value={assignee}>
            {assignee}
          </option>
        ))}
      </Select>
      <Input
        type="number"
        placeholder="Min budget"
        value={value.budgetMin}
        onChange={(event) => onChange({ ...value, budgetMin: event.target.value })}
        aria-label="Minimum budget"
      />
      <Input
        type="number"
        placeholder="Max budget"
        value={value.budgetMax}
        onChange={(event) => onChange({ ...value, budgetMax: event.target.value })}
        aria-label="Maximum budget"
      />
      <Input
        type="date"
        value={value.createdFrom}
        onChange={(event) => onChange({ ...value, createdFrom: event.target.value })}
        aria-label="Created from"
      />
      <Input
        type="date"
        value={value.createdTo}
        onChange={(event) => onChange({ ...value, createdTo: event.target.value })}
        aria-label="Created to"
      />
    </div>
  );
}
