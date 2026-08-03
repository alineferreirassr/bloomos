import { afterEach, describe, expect, it } from "vitest";
import {
  archiveVendor,
  createVendor,
  getLeads,
  getVendorById,
  getVendors,
  resetAllMockData,
  restoreVendor,
  setVendorPreferredStatus,
  setVendorStatus,
  updateVendor,
} from "@/lib/data";
import type { CreateVendorInput } from "@/modules/vendors/schema";

/**
 * Proves Vendors is reachable through the central `@/lib/data` barrel — the
 * same central provider every other module goes through — without any
 * caller ever importing `lib/data/vendors/supabaseRepository.ts` or
 * `mockRepository.ts` directly. Exhaustive CRUD/filter/sort behavior is
 * already covered by `vendors/mockRepository.test.ts` and
 * `vendors/supabaseRepository.test.ts`; this file only proves reachability
 * and non-interference with the rest of the central data layer.
 */

afterEach(() => {
  resetAllMockData();
});

const MINIMAL_INPUT: CreateVendorInput = {
  company_name: "Central Provider Test Vendor",
  display_name: null,
  contact_person: null,
  email: null,
  phone: null,
  website: null,
  tax_id: null,
  address: null,
  city: null,
  state: null,
  zip_code: null,
  country: null,
  notes: null,
  tags: [],
  default_currency: "USD",
  payment_terms: null,
};

describe("Vendors via the central data provider (@/lib/data)", () => {
  it("exposes all 8 VendorsRepository operations without a direct repository import", async () => {
    const created = await createVendor(MINIMAL_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const fetched = await getVendorById(created.data.id);
    expect(fetched.id).toBe(created.data.id);

    const listed = await getVendors();
    expect(listed.some((v) => v.id === created.data.id)).toBe(true);

    const updated = await updateVendor(created.data.id, { notes: "updated via central provider" });
    expect(updated.success).toBe(true);

    const statusChanged = await setVendorStatus(created.data.id, "inactive");
    expect(statusChanged.success).toBe(true);

    const preferredChanged = await setVendorPreferredStatus(created.data.id, true);
    expect(preferredChanged.success).toBe(true);

    const archived = await archiveVendor(created.data.id);
    expect(archived.success).toBe(true);

    const restored = await restoreVendor(created.data.id);
    expect(restored.success).toBe(true);
  });

  it("defaults to mock mode and excludes archived vendors, matching every other module's default list behavior", async () => {
    const vendors = await getVendors();
    expect(vendors.every((v) => v.archived_at === null)).toBe(true);
  });

  it("resetAllMockData() resets the Vendors store along with every other module", async () => {
    const created = await createVendor(MINIMAL_INPUT);
    expect(created.success).toBe(true);

    resetAllMockData();

    const vendors = await getVendors();
    expect(vendors.some((v) => v.company_name === "Central Provider Test Vendor")).toBe(false);
  });

  it("leaves other central-provider modules unaffected (existing repositories remain available)", async () => {
    const leads = await getLeads();
    expect(Array.isArray(leads)).toBe(true);
  });
});
