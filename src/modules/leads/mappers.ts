import type { Lead } from "@/types/lead";
import type { LeadFormInput } from "@/modules/leads/schema";

/** Converts a Lead record's null/number fields into the plain-string shape the form works with. */
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
