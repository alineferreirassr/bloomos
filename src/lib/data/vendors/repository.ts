import type { Vendor } from "@/types/vendor";
import type { VendorStatus } from "@/core/enums/vendorStatus";
import type { CreateVendorInput, UpdateVendorInput } from "@/modules/vendors/schema";
import type { DataResult } from "@/lib/data/result";

export interface VendorFilters {
  search?: string;
  status?: VendorStatus | "all";
  isPreferred?: boolean;
  tags?: string[];
  includeArchived?: boolean;
}

export interface VendorSort {
  sortBy?: "company_name" | "display_name" | "created_at" | "updated_at" | "is_preferred";
  sortDirection?: "asc" | "desc";
}

/**
 * The single Vendors persistence contract — implemented so far only by the
 * Supabase repository (`lib/data/vendors/supabaseRepository.ts`); no mock
 * repository or `lib/data/index.ts` wiring exists yet. Every other module's
 * mock repository exists so UI can be built against
 * `NEXT_PUBLIC_DATA_MODE=mock` before or independent of a migration —
 * Vendors' migration is already live and its UI is a later phase, so a mock
 * would be unused scaffolding with no consumer. Add one (and wire
 * `selectRepository`) when Vendors UI work actually begins.
 *
 * `status` and `is_preferred` each get a dedicated method
 * (setVendorStatus/setVendorPreferredStatus) rather than living in
 * UpdateVendorInput, matching Client's precedent of giving
 * `internal_status`/`is_vip` their own quick-action methods with their own
 * Timeline activity type. No delete method — soft-delete via
 * archiveVendor/restoreVendor only.
 */
export interface VendorsRepository {
  getVendors(filters?: VendorFilters, sort?: VendorSort): Promise<Vendor[]>;
  getVendorById(id: string): Promise<Vendor>;
  createVendor(input: CreateVendorInput): Promise<DataResult<Vendor>>;
  updateVendor(id: string, input: UpdateVendorInput): Promise<DataResult<Vendor>>;
  archiveVendor(id: string): Promise<DataResult<Vendor>>;
  restoreVendor(id: string): Promise<DataResult<Vendor>>;
  setVendorStatus(id: string, status: VendorStatus): Promise<DataResult<Vendor>>;
  setVendorPreferredStatus(id: string, isPreferred: boolean): Promise<DataResult<Vendor>>;
}
