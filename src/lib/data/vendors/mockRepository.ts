import type { Vendor } from "@/types/vendor";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { VendorStatus } from "@/core/enums/vendorStatus";
import { NotFoundError } from "@/core/errors";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readVendors, writeVendors } from "@/lib/data/mock/vendorsStore";
import { getCoreTimelineService } from "@/core/timeline";
import { createVendorInputSchema, updateVendorInputSchema, type CreateVendorInput, type UpdateVendorInput } from "@/modules/vendors/schema";
import type { VendorFilters, VendorSort, VendorsRepository } from "@/lib/data/vendors/repository";

const TAX_ID_CONFLICT_MESSAGE = "This Tax ID is already in use in this workspace.";

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function findVendorRow(id: string): Vendor | null {
  return readVendors().find((vendor) => vendor.id === id && vendor.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}

/**
 * Mirrors the `vendors_workspace_tax_id_unique` partial unique index
 * (workspace_id, tax_id) where tax_id is not null — mock mode has no
 * database constraint to enforce this, so it's checked explicitly here,
 * returning the exact same field-level conflict message the Supabase
 * repository returns on a real 23505.
 */
function findDuplicateTaxId(taxId: string | null, excludeId?: string): boolean {
  if (!taxId) return false;
  return readVendors().some(
    (vendor) => vendor.workspace_id === CURRENT_WORKSPACE_ID && vendor.tax_id === taxId && vendor.id !== excludeId,
  );
}

async function getVendors(filters: VendorFilters = {}, sort: VendorSort = {}): Promise<Vendor[]> {
  await delay(150);
  const { search, status, isPreferred, tags, includeArchived = false } = filters;
  const { sortBy = "created_at", sortDirection = "desc" } = sort;

  let results = readVendors().filter((vendor) => {
    if (vendor.workspace_id !== CURRENT_WORKSPACE_ID) return false;
    if (!includeArchived && vendor.archived_at) return false;
    if (status && status !== "all" && vendor.status !== status) return false;
    if (isPreferred !== undefined && vendor.is_preferred !== isPreferred) return false;
    if (tags && tags.length > 0 && !tags.some((tag) => vendor.tags.includes(tag))) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = `${vendor.company_name} ${vendor.display_name ?? ""} ${vendor.contact_person ?? ""} ${vendor.email ?? ""} ${vendor.phone ?? ""} ${vendor.tax_id ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });

  results = [...results].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    let comparison: number;
    if (typeof aValue === "boolean" || typeof bValue === "boolean") {
      comparison = Number(aValue) - Number(bValue);
    } else {
      comparison = String(aValue ?? "").localeCompare(String(bValue ?? ""));
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  return results;
}

async function getVendorById(id: string): Promise<Vendor> {
  await delay(100);
  const vendor = findVendorRow(id);
  if (!vendor) {
    throw new NotFoundError(`Vendor ${id} was not found`);
  }
  return vendor;
}

async function createVendor(input: CreateVendorInput): Promise<DataResult<Vendor>> {
  const parsed = createVendorInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  if (findDuplicateTaxId(parsed.data.tax_id)) {
    return fail(TAX_ID_CONFLICT_MESSAGE, { tax_id: TAX_ID_CONFLICT_MESSAGE });
  }

  const timestamp = nowIso();
  const vendor: Vendor = {
    id: generateId("vendor"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...parsed.data,
    status: "active",
    is_preferred: false,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeVendors([...readVendors(), vendor]);

  await getCoreTimelineService().recordActivity(
    vendor.workspace_id,
    "vendor",
    vendor.id,
    CURRENT_ACTOR,
    "vendor_created",
    "Vendor created",
  );

  return ok(vendor);
}

async function updateVendor(id: string, input: UpdateVendorInput): Promise<DataResult<Vendor>> {
  const existing = findVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }

  const parsed = updateVendorInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const patch: Partial<Vendor> = {};
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    const value = parsed.data[key];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return ok(existing);
  }

  if (patch.tax_id !== undefined && findDuplicateTaxId(patch.tax_id, id)) {
    return fail(TAX_ID_CONFLICT_MESSAGE, { tax_id: TAX_ID_CONFLICT_MESSAGE });
  }

  const updated: Vendor = { ...existing, ...patch, updated_at: nowIso() };
  writeVendors(readVendors().map((vendor) => (vendor.id === id ? updated : vendor)));

  await getCoreTimelineService().recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    CURRENT_ACTOR,
    "vendor_updated",
    "Vendor information updated",
  );

  return ok(updated);
}

async function archiveVendor(id: string): Promise<DataResult<Vendor>> {
  const existing = findVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (existing.archived_at) {
    return fail("This vendor is already archived.");
  }

  const timestamp = nowIso();
  const updated: Vendor = { ...existing, archived_at: timestamp, updated_at: timestamp };
  writeVendors(readVendors().map((vendor) => (vendor.id === id ? updated : vendor)));

  await getCoreTimelineService().recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    CURRENT_ACTOR,
    "vendor_archived",
    "Vendor archived",
  );

  return ok(updated);
}

async function restoreVendor(id: string): Promise<DataResult<Vendor>> {
  const existing = findVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (!existing.archived_at) {
    return fail("This vendor is not archived.");
  }

  const updated: Vendor = { ...existing, archived_at: null, updated_at: nowIso() };
  writeVendors(readVendors().map((vendor) => (vendor.id === id ? updated : vendor)));

  await getCoreTimelineService().recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    CURRENT_ACTOR,
    "vendor_restored",
    "Vendor restored",
  );

  return ok(updated);
}

async function setVendorStatus(id: string, status: VendorStatus): Promise<DataResult<Vendor>> {
  const existing = findVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (existing.status === status) {
    return ok(existing);
  }

  const updated: Vendor = { ...existing, status, updated_at: nowIso() };
  writeVendors(readVendors().map((vendor) => (vendor.id === id ? updated : vendor)));

  await getCoreTimelineService().recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    CURRENT_ACTOR,
    "vendor_updated",
    `Status changed from ${existing.status} to ${status}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

async function setVendorPreferredStatus(id: string, isPreferred: boolean): Promise<DataResult<Vendor>> {
  const existing = findVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (existing.is_preferred === isPreferred) {
    return ok(existing);
  }

  const updated: Vendor = { ...existing, is_preferred: isPreferred, updated_at: nowIso() };
  writeVendors(readVendors().map((vendor) => (vendor.id === id ? updated : vendor)));

  await getCoreTimelineService().recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    CURRENT_ACTOR,
    "vendor_preferred_status_changed",
    isPreferred ? "Marked as preferred" : "Removed preferred status",
    { is_preferred: isPreferred },
  );

  return ok(updated);
}

async function getTimelineByVendorId(vendorId: string): Promise<TimelineActivity[]> {
  const vendor = findVendorRow(vendorId);
  if (!vendor) return [];
  return getCoreTimelineService().getTimelineForOwner(vendor.workspace_id, "vendor", vendorId);
}

export const mockVendorsRepository: VendorsRepository = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  archiveVendor,
  restoreVendor,
  setVendorStatus,
  setVendorPreferredStatus,
  getTimelineByVendorId,
};
