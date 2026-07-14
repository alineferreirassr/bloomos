import type { Lead } from "@/types/lead";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const SEED_LEADS: Lead[] = [
  {
    id: "lead_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    first_name: "Sofia",
    last_name: "Marchetti",
    email: "sofia.marchetti@example.com",
    phone: "+1 415 555 0142",
    instagram: "@sofia.marchetti",
    source: "Instagram",
    event_type: "Proposal",
    event_date: "2026-10-12",
    location: "Big Sur, CA",
    budget_min: 15000,
    budget_max: 25000,
    message:
      "We're looking for a sunset proposal setup overlooking the coast, something intimate for two.",
    status: "qualified",
    assigned_to: "Aline Ferreira",
    converted_client_id: null,
    created_at: "2026-06-02T14:30:00.000Z",
    updated_at: "2026-06-20T09:15:00.000Z",
    archived_at: null,
  },
  {
    id: "lead_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    first_name: "Daniel",
    last_name: "Reyes",
    email: "daniel.reyes@example.com",
    phone: "+1 310 555 0198",
    instagram: null,
    source: "Referral",
    event_type: "Anniversary",
    event_date: null,
    location: "Napa Valley, CA",
    budget_min: 8000,
    budget_max: 12000,
    message: "Celebrating our 10th anniversary, referred by the Marchettis.",
    status: "contacted",
    assigned_to: "Aline Ferreira",
    converted_client_id: null,
    created_at: "2026-06-18T18:05:00.000Z",
    updated_at: "2026-06-19T10:00:00.000Z",
    archived_at: null,
  },
  {
    id: "lead_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    first_name: "Priya",
    last_name: "Nair",
    email: "priya.nair@example.com",
    phone: null,
    instagram: "@priya.nair",
    source: "Website",
    event_type: "Proposal",
    event_date: "2026-09-01",
    location: "Malibu, CA",
    budget_min: 20000,
    budget_max: 30000,
    message: "Looking for something on the beach at golden hour.",
    status: "proposal_sent",
    assigned_to: null,
    converted_client_id: null,
    created_at: "2026-05-28T12:00:00.000Z",
    updated_at: "2026-06-15T16:45:00.000Z",
    archived_at: null,
  },
  {
    id: "lead_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    first_name: "Marcus",
    last_name: "Chen",
    email: "marcus.chen@example.com",
    phone: "+1 650 555 0111",
    instagram: null,
    source: "Google",
    event_type: "Proposal",
    event_date: null,
    location: null,
    budget_min: null,
    budget_max: null,
    message: "Just started looking around, no firm plans yet.",
    status: "new",
    assigned_to: null,
    converted_client_id: null,
    created_at: "2026-07-10T08:20:00.000Z",
    updated_at: "2026-07-10T08:20:00.000Z",
    archived_at: null,
  },
  {
    id: "lead_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    first_name: "Elena",
    last_name: "Volkov",
    email: "elena.volkov@example.com",
    phone: "+1 212 555 0177",
    instagram: "@elena.volkov",
    source: "Wedding Planner",
    event_type: "Wedding",
    event_date: "2026-04-18",
    location: "Lake Tahoe, CA",
    budget_min: 5000,
    budget_max: 7000,
    message: "Budget didn't line up with what we discussed in consultation.",
    status: "lost",
    assigned_to: "Aline Ferreira",
    converted_client_id: null,
    created_at: "2026-04-01T11:00:00.000Z",
    updated_at: "2026-04-22T13:30:00.000Z",
    archived_at: null,
  },
];

let leads: Lead[] = SEED_LEADS.map((lead) => ({ ...lead }));

export function readLeads(): Lead[] {
  return leads;
}

export function writeLeads(next: Lead[]): void {
  leads = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetLeadsStore(): void {
  leads = SEED_LEADS.map((lead) => ({ ...lead }));
}
