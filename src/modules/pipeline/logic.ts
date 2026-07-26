import type { Lead } from "@/types/lead";
import type { LeadFormInput } from "@/modules/leads/schema";
import { COMMERCIAL_COLUMNS, columnForStatus, type CommercialColumnId } from "@/modules/pipeline/constants";
import { getFullName } from "@/lib/personName";

export interface CommercialPipelineFilterValues {
  search: string;
  assignedTo: string | "all";
  budgetMin: string;
  budgetMax: string;
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_COMMERCIAL_FILTERS: CommercialPipelineFilterValues = {
  search: "",
  assignedTo: "all",
  budgetMin: "",
  budgetMax: "",
  createdFrom: "",
  createdTo: "",
};

/** Every distinct non-empty `assigned_to` value across the board's Leads, for the filter's own options list. */
export function collectAssignees(leads: Lead[]): string[] {
  const set = new Set<string>();
  for (const lead of leads) {
    if (lead.assigned_to) set.add(lead.assigned_to);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * All filtering happens in memory over one already-fetched Lead list — the
 * board loads every working-status Lead once (see
 * COMMERCIAL_PIPELINE_STATUSES) rather than issuing one query per column or
 * per filter, and `assignedTo`/budget/date-range aren't part of the shared
 * `LeadFilters` repository contract, so they can't be pushed server-side
 * without widening that contract for every other Lead view too.
 */
export function filterCommercialLeads(leads: Lead[], filters: CommercialPipelineFilterValues): Lead[] {
  const search = filters.search.trim().toLowerCase();
  const budgetMin = filters.budgetMin === "" ? null : Number(filters.budgetMin);
  const budgetMax = filters.budgetMax === "" ? null : Number(filters.budgetMax);
  const createdFrom = filters.createdFrom === "" ? null : filters.createdFrom;
  const createdTo = filters.createdTo === "" ? null : filters.createdTo;

  return leads.filter((lead) => {
    if (search) {
      const haystack = `${getFullName(lead)} ${lead.email} ${lead.event_type ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.assignedTo !== "all" && lead.assigned_to !== filters.assignedTo) return false;
    if (budgetMin !== null) {
      const value = lead.budget_max ?? lead.budget_min;
      if (value === null || value < budgetMin) return false;
    }
    if (budgetMax !== null) {
      const value = lead.budget_min ?? lead.budget_max;
      if (value === null || value > budgetMax) return false;
    }
    if (createdFrom && lead.created_at < createdFrom) return false;
    if (createdTo && lead.created_at > `${createdTo}T23:59:59.999Z`) return false;
    return true;
  });
}

export type CommercialBoardColumns = Record<CommercialColumnId, Lead[]>;

/** Groups already-filtered Leads by column. Terminal statuses (converted/lost/archived) never appear in any column — they've left the pipeline. */
export function groupLeadsByColumn(leads: Lead[]): CommercialBoardColumns {
  const columns = Object.fromEntries(COMMERCIAL_COLUMNS.map((c) => [c.id, [] as Lead[]])) as CommercialBoardColumns;
  for (const lead of leads) {
    const columnId = columnForStatus(lead.status);
    if (columnId) columns[columnId].push(lead);
  }
  return columns;
}

/** Sum of each Lead's best-known budget figure (max preferred, falling back to min) for a column header's optional total. */
export function columnPipelineValue(leads: Lead[]): number {
  return leads.reduce((sum, lead) => sum + (lead.budget_max ?? lead.budget_min ?? 0), 0);
}

/** Converts a loaded Lead back into the form shape updateLead() expects — used by "Assign Team," the only Quick Action that needs a full-form resubmission since Leads has no partial-update endpoint. */
export function leadToFormInput(lead: Lead): LeadFormInput {
  return {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone ?? "",
    instagram: lead.instagram ?? "",
    source: lead.source,
    event_type: lead.event_type ?? "",
    event_date: lead.event_date ?? "",
    location: lead.location ?? "",
    budget_min: lead.budget_min === null ? "" : String(lead.budget_min),
    budget_max: lead.budget_max === null ? "" : String(lead.budget_max),
    message: lead.message ?? "",
    assigned_to: lead.assigned_to ?? "",
  };
}
