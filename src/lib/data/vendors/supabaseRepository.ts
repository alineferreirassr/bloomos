import type { Vendor } from "@/types/vendor";
import type { Database } from "@/types/database.types";
import type { VendorStatus } from "@/core/enums/vendorStatus";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { getCoreTimelineService } from "@/core/timeline";
import { createVendorInputSchema, updateVendorInputSchema, type CreateVendorInput, type UpdateVendorInput } from "@/modules/vendors/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapVendorRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { VendorFilters, VendorSort, VendorsRepository } from "@/lib/data/vendors/repository";

const UNIQUE_VIOLATION = "23505";

// Vendor's 5 activity types + display labels are registered centrally in
// core/timeline/defaultActivityTypeRegistrations.ts (registerDefaultTimelineActivityTypes),
// not here — this file only ever consumes the Timeline service via
// getCoreTimelineService(...).recordActivity(...) below, never mutating the
// global activity-type registry itself.

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

/** Same rationale as clients/supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

/** Internal existence check — returns null rather than throwing, matching clients/supabaseRepository.ts's fetchClientRow. RLS means a vendor in another Workspace is simply invisible here, not a distinct error case. */
async function fetchVendorRow(id: string): Promise<Vendor | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("vendors").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapVendorRow(data) : null;
}

async function getVendors(filters: VendorFilters = {}, sort: VendorSort = {}): Promise<Vendor[]> {
  const session = await requireWorkspaceSession();
  const { search, status, isPreferred, tags, includeArchived = false } = filters;
  const { sortBy = "created_at", sortDirection = "desc" } = sort;

  const supabase = createSupabaseClient();
  let query = supabase.from("vendors").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (isPreferred !== undefined) {
    query = query.eq("is_preferred", isPreferred);
  }
  if (tags && tags.length > 0) {
    query = query.overlaps("tags", tags);
  }

  const { data, error } = await query.order(sortBy, { ascending: sortDirection === "asc" });
  if (error) throw normalizeSupabaseError(error);

  const vendors = (data ?? []).map(mapVendorRow);

  // Matched in application code, not pushed into SQL — same rationale as
  // clients/supabaseRepository.ts's getClients search.
  const q = search?.trim().toLowerCase();
  if (!q) return vendors;
  return vendors.filter((vendor) => {
    const haystack = `${vendor.company_name} ${vendor.display_name ?? ""} ${vendor.contact_person ?? ""} ${vendor.email ?? ""} ${vendor.phone ?? ""} ${vendor.tax_id ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getVendorById(id: string): Promise<Vendor> {
  const vendor = await fetchVendorRow(id);
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

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      workspace_id: session.workspace.id,
      ...parsed.data,
      status: "active",
      is_preferred: false,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return fail("This Tax ID is already in use in this workspace.", { tax_id: "This Tax ID is already in use in this workspace." });
    }
    throw normalizeSupabaseError(error);
  }

  const vendor = mapVendorRow(data);
  await getCoreTimelineService(supabase).recordActivity(
    vendor.workspace_id,
    "vendor",
    vendor.id,
    resolveActorName(session),
    "vendor_created",
    "Vendor created",
  );

  return ok(vendor);
}

async function updateVendor(id: string, input: UpdateVendorInput): Promise<DataResult<Vendor>> {
  const existing = await fetchVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }

  const parsed = updateVendorInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  // True partial patch — only fields the caller actually provided are
  // written, matching documents/supabaseRepository.ts's updateDocumentMetadata
  // convention rather than clients/supabaseRepository.ts's full-replace
  // updateClient (Vendors has no single-purpose edit form dictating a fixed
  // field set the way Client's general edit form does).
  const patch: Database["public"]["Tables"]["vendors"]["Update"] = {};
  for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
    const value = parsed.data[key];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return ok(existing);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.from("vendors").update(patch).eq("id", id).select("*").single();
  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return fail("This Tax ID is already in use in this workspace.", { tax_id: "This Tax ID is already in use in this workspace." });
    }
    throw normalizeSupabaseError(error);
  }

  const updated = mapVendorRow(data);
  await getCoreTimelineService(supabase).recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    resolveActorName(session),
    "vendor_updated",
    "Vendor information updated",
  );

  return ok(updated);
}

async function archiveVendor(id: string): Promise<DataResult<Vendor>> {
  const existing = await fetchVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (existing.archived_at) {
    return fail("This vendor is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("vendors")
    .update({ archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapVendorRow(data);
  await getCoreTimelineService(supabase).recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    resolveActorName(session),
    "vendor_archived",
    "Vendor archived",
  );

  return ok(updated);
}

async function restoreVendor(id: string): Promise<DataResult<Vendor>> {
  const existing = await fetchVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (!existing.archived_at) {
    return fail("This vendor is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("vendors")
    .update({ archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapVendorRow(data);
  await getCoreTimelineService(supabase).recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    resolveActorName(session),
    "vendor_restored",
    "Vendor restored",
  );

  return ok(updated);
}

async function setVendorStatus(id: string, status: VendorStatus): Promise<DataResult<Vendor>> {
  const existing = await fetchVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (existing.status === status) {
    return ok(existing);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("vendors").update({ status }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapVendorRow(data);
  await getCoreTimelineService(supabase).recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    resolveActorName(session),
    "vendor_updated",
    `Status changed from ${existing.status} to ${status}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

async function setVendorPreferredStatus(id: string, isPreferred: boolean): Promise<DataResult<Vendor>> {
  const existing = await fetchVendorRow(id);
  if (!existing) {
    return fail("Vendor not found.");
  }
  if (existing.is_preferred === isPreferred) {
    return ok(existing);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("vendors")
    .update({ is_preferred: isPreferred })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapVendorRow(data);
  await getCoreTimelineService(supabase).recordActivity(
    updated.workspace_id,
    "vendor",
    id,
    resolveActorName(session),
    "vendor_preferred_status_changed",
    isPreferred ? "Marked as preferred" : "Removed preferred status",
    { is_preferred: isPreferred },
  );

  return ok(updated);
}

export const supabaseVendorsRepository: VendorsRepository = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  archiveVendor,
  restoreVendor,
  setVendorStatus,
  setVendorPreferredStatus,
};
