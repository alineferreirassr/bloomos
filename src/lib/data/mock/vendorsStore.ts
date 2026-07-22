import type { Vendor } from "@/types/vendor";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * Seed fixtures exist purely so mock-mode Vendors isn't an empty list —
 * every other mock store (leads, clients, events, inventory items...)
 * follows this same convention. Isolated to mock mode only; never read by
 * the Supabase repository.
 */
const SEED_VENDORS: Vendor[] = [
  {
    id: "vendor_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    company_name: "Bloom & Stem Florals",
    display_name: "Bloom & Stem",
    contact_person: "Priya Anand",
    email: "priya@bloomandstem.example",
    phone: "+1-555-0101",
    website: "https://bloomandstem.example",
    tax_id: "TAX-10001",
    address: "142 Garden Way",
    city: "Portland",
    state: "OR",
    zip_code: "97201",
    country: "US",
    notes: "Preferred florist for ceremony and reception arrangements.",
    status: "active",
    tags: ["florist", "ceremony"],
    default_currency: "USD",
    payment_terms: "Net 30",
    is_preferred: true,
    created_at: "2026-06-01T09:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "vendor_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    company_name: "Candlelight Co",
    display_name: null,
    contact_person: "Marcus Webb",
    email: "marcus@candlelightco.example",
    phone: "+1-555-0102",
    website: null,
    tax_id: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
    notes: null,
    status: "active",
    tags: ["candles", "decor"],
    default_currency: "USD",
    payment_terms: null,
    is_preferred: false,
    created_at: "2026-06-05T09:00:00.000Z",
    updated_at: "2026-06-05T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "vendor_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    company_name: "Heritage Linens (discontinued)",
    display_name: "Heritage Linens",
    contact_person: null,
    email: null,
    phone: null,
    website: null,
    tax_id: "TAX-10003",
    address: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
    notes: "No longer supplying — replaced by Candlelight Co for linens.",
    status: "inactive",
    tags: ["linens"],
    default_currency: "USD",
    payment_terms: null,
    is_preferred: false,
    created_at: "2025-09-01T09:00:00.000Z",
    updated_at: "2026-05-01T09:00:00.000Z",
    archived_at: "2026-05-01T09:00:00.000Z",
  },
];

let vendors: Vendor[] = SEED_VENDORS.map((vendor) => ({ ...vendor }));

export function readVendors(): Vendor[] {
  return vendors;
}

export function writeVendors(next: Vendor[]): void {
  vendors = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetVendorsStore(): void {
  vendors = SEED_VENDORS.map((vendor) => ({ ...vendor }));
}
