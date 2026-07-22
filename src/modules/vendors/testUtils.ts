import type { Vendor } from "@/types/vendor";

/** Test-only fixture factory — not imported by any app code. */
export function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: "vendor_test",
    workspace_id: "ws_test",
    company_name: "Test Vendor Co",
    display_name: null,
    contact_person: null,
    email: "vendor@example.com",
    phone: null,
    website: null,
    tax_id: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
    notes: null,
    status: "active",
    tags: [],
    default_currency: "USD",
    payment_terms: null,
    is_preferred: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}
