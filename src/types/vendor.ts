import type { VendorStatus } from "@/core/enums/vendorStatus";

/**
 * A supplier BloomOS purchases from or books through. Field names mirror
 * docs/database.md conventions (snake_case) rather than being translated to
 * camelCase, same as Client/Event/InventoryItem — no Supabase mapping layer
 * exists yet.
 *
 * No relationship to InventoryItem or a future Purchases module exists on
 * this type yet — `inventory_items.primary_vendor_id` remains unenforced by
 * an FK, and that integration is a separate, later phase.
 */
export interface Vendor {
  id: string;
  workspace_id: string;
  company_name: string;
  display_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tax_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  /** A lightweight scalar note, distinct from the structured Core Notes system every EntityType already supports via owner_type. */
  notes: string | null;

  status: VendorStatus;
  tags: string[];
  default_currency: string;
  payment_terms: string | null;
  is_preferred: boolean;

  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
