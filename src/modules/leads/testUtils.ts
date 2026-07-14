import type { Lead } from "@/types/lead";

/** Test-only fixture factory — not imported by any app code. */
export function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead_test",
    workspace_id: "ws_test",
    first_name: "Test",
    last_name: "Lead",
    email: "test@example.com",
    phone: null,
    instagram: null,
    source: "Website",
    event_type: null,
    event_date: null,
    location: null,
    budget_min: null,
    budget_max: null,
    message: null,
    status: "new",
    assigned_to: null,
    converted_client_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}
