import type { Vendor } from "@/types/vendor";
import type { VendorStatus } from "@/core/enums/vendorStatus";
import type { CreateVendorInput, UpdateVendorInput } from "@/modules/vendors/schema";
import type { DataResult } from "@/lib/data/result";
import type { TimelineActivity } from "@/types/timelineActivity";

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
 * The single Vendors persistence contract, implemented by both
 * `lib/data/vendors/mockRepository.ts` and `lib/data/vendors/supabaseRepository.ts`
 * and selected via `lib/data/provider.ts`'s `selectRepository()`, wired
 * through `lib/data/index.ts`.
 *
 * `status` and `is_preferred` each get a dedicated method
 * (setVendorStatus/setVendorPreferredStatus) rather than living in
 * UpdateVendorInput, matching Client's precedent of giving
 * `internal_status`/`is_vip` their own quick-action methods with their own
 * Timeline activity type. No delete method — soft-delete via
 * archiveVendor/restoreVendor only.
 *
 * `getTimelineByVendorId` is read-only — every write already goes through
 * Core's `getCoreTimelineService().recordActivity(...)` inside the
 * create/update/archive/restore/status/preferred methods above; this just
 * exposes the matching read via the same Core Timeline service
 * (`getTimelineForOwner`), never a Vendor-specific Timeline store.
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
  getTimelineByVendorId(vendorId: string): Promise<TimelineActivity[]>;
}
