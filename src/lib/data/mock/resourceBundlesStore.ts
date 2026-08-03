import type { ResourceBundle, BundleResourceLine, BundleStatus } from "@/types/allocation";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27.1, Step 7 — Resource Bundle Registry persistence. Same convention as `allocationRequestsStore.ts`. */
let bundles: ResourceBundle[] = [];

export function resetResourceBundlesStore(): void {
  bundles = [];
}

export interface CreateResourceBundleInput {
  name: string;
  description: string | null;
  required_resources: BundleResourceLine[];
  optional_resources: BundleResourceLine[];
  min_quantity: number;
  max_quantity: number | null;
}

export type UpdateResourceBundleInput = Partial<CreateResourceBundleInput>;

async function listBundlesForWorkspace(workspaceId: string, includeArchived = false): Promise<ResourceBundle[]> {
  return bundles.filter((b) => b.workspace_id === workspaceId && (includeArchived || b.status === "active"));
}

async function getBundleById(id: string): Promise<ResourceBundle | null> {
  return bundles.find((b) => b.id === id) ?? null;
}

function validateBundleInput(input: Pick<CreateResourceBundleInput, "name" | "min_quantity" | "max_quantity">): string | null {
  if (!input.name.trim()) return "name";
  if (input.min_quantity < 0) return "min_quantity";
  if (input.max_quantity !== null && input.max_quantity < input.min_quantity) return "max_quantity";
  return null;
}

async function createBundle(workspaceId: string, createdBy: string, input: CreateResourceBundleInput): Promise<DataResult<ResourceBundle>> {
  const invalidField = validateBundleInput(input);
  if (invalidField === "name") return fail("Please fix the highlighted fields.", { name: "Bundle name is required." });
  if (invalidField === "min_quantity") return fail("Please fix the highlighted fields.", { min_quantity: "Minimum quantity cannot be negative." });
  if (invalidField === "max_quantity") return fail("Please fix the highlighted fields.", { max_quantity: "Maximum quantity cannot be less than the minimum." });

  const timestamp = nowIso();
  const bundle: ResourceBundle = {
    id: generateId("resource_bundle"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    description: input.description,
    required_resources: input.required_resources,
    optional_resources: input.optional_resources,
    min_quantity: input.min_quantity,
    max_quantity: input.max_quantity,
    status: "active",
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  bundles = [...bundles, bundle];
  return ok(bundle);
}

async function updateBundle(id: string, workspaceId: string, input: UpdateResourceBundleInput): Promise<DataResult<ResourceBundle>> {
  const existing = bundles.find((b) => b.id === id && b.workspace_id === workspaceId);
  if (!existing) return fail("This resource bundle could not be found.");
  if (input.name !== undefined && !input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Bundle name is required." });

  const updated: ResourceBundle = { ...existing, ...input, name: input.name?.trim() ?? existing.name, updated_at: nowIso() };
  bundles = bundles.map((b) => (b.id === id ? updated : b));
  return ok(updated);
}

async function setBundleStatus(id: string, workspaceId: string, status: BundleStatus): Promise<DataResult<ResourceBundle>> {
  const existing = bundles.find((b) => b.id === id && b.workspace_id === workspaceId);
  if (!existing) return fail("This resource bundle could not be found.");

  const timestamp = nowIso();
  const updated: ResourceBundle = { ...existing, status, archived_at: status === "archived" ? timestamp : null, updated_at: timestamp };
  bundles = bundles.map((b) => (b.id === id ? updated : b));
  return ok(updated);
}

async function duplicateBundle(id: string, workspaceId: string, createdBy: string): Promise<DataResult<ResourceBundle>> {
  const existing = bundles.find((b) => b.id === id && b.workspace_id === workspaceId);
  if (!existing) return fail("This resource bundle could not be found.");

  const timestamp = nowIso();
  const duplicate: ResourceBundle = {
    ...existing,
    id: generateId("resource_bundle"),
    name: `${existing.name} (Copy)`,
    status: "active",
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  bundles = [...bundles, duplicate];
  return ok(duplicate);
}

export interface ResourceBundlesRepository {
  listBundlesForWorkspace: typeof listBundlesForWorkspace;
  getBundleById: typeof getBundleById;
  createBundle: typeof createBundle;
  updateBundle: typeof updateBundle;
  setBundleStatus: typeof setBundleStatus;
  duplicateBundle: typeof duplicateBundle;
}

export const mockResourceBundlesRepository: ResourceBundlesRepository = {
  listBundlesForWorkspace,
  getBundleById,
  createBundle,
  updateBundle,
  setBundleStatus,
  duplicateBundle,
};
