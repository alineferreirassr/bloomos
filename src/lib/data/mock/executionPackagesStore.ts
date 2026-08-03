import type { ExecutionPackage, ExecutionStatus, ExecutionContext, ExecutionMetadata, ExecutionSource, ExecutionSnapshot, ExecutionInstructions, ExecutionAttachment, ExecutionVersion } from "@/types/executionPackage";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 27.3 — Execution Package persistence. A package is a
 * mutable shell (`metadata`/`context`/`source`/`status`) around an
 * append-only `versions[]` array — each `ExecutionVersion` is frozen the
 * moment it's created and never mutated again, only ever added to. Same
 * `let` array + `resetXStore()` convention every mock store in this
 * codebase uses.
 */
let packages: ExecutionPackage[] = [];

export function resetExecutionPackagesStore(): void {
  packages = [];
}

export interface CreateVersionInput {
  snapshot: ExecutionSnapshot;
  instructions: ExecutionInstructions;
  attachments: ExecutionAttachment[];
  notes: string | null;
  reason: string | null;
}

export interface CreateExecutionPackageInput {
  metadata: ExecutionMetadata;
  context: ExecutionContext;
  source: ExecutionSource;
  initialVersion: CreateVersionInput;
}

async function listPackagesForWorkspace(workspaceId: string, includeArchived = false): Promise<ExecutionPackage[]> {
  return packages.filter((p) => p.workspace_id === workspaceId && (includeArchived || p.status !== "archived"));
}

async function getPackageById(id: string): Promise<ExecutionPackage | null> {
  return packages.find((p) => p.id === id) ?? null;
}

function buildVersion(packageId: string, workspaceId: string, versionNumber: number, createdBy: string, input: CreateVersionInput): ExecutionVersion {
  return {
    id: generateId("execution_version"),
    package_id: packageId,
    workspace_id: workspaceId,
    version_number: versionNumber,
    snapshot: input.snapshot,
    instructions: input.instructions,
    attachments: input.attachments,
    notes: input.notes,
    reason: input.reason,
    created_by: createdBy,
    created_at: nowIso(),
  };
}

async function createPackage(workspaceId: string, createdBy: string, input: CreateExecutionPackageInput): Promise<DataResult<ExecutionPackage>> {
  if (!input.metadata.title.trim()) return fail("Please fix the highlighted fields.", { title: "Package title is required." });

  const timestamp = nowIso();
  const packageId = generateId("execution_package");
  const firstVersion = buildVersion(packageId, workspaceId, 1, createdBy, input.initialVersion);

  const created: ExecutionPackage = {
    id: packageId,
    workspace_id: workspaceId,
    metadata: { ...input.metadata, title: input.metadata.title.trim() },
    context: input.context,
    source: input.source,
    status: "draft",
    current_version_id: firstVersion.id,
    versions: [firstVersion],
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    approved_at: null,
    approved_by: null,
    archived_at: null,
  };
  packages = [...packages, created];
  return ok(created);
}

/** Appends a new immutable version — never edits an existing one. The new version becomes `current_version_id`; the package resets to `"draft"` (a new version needs re-validation/re-approval), matching the same discipline a structural plan edit resets approval state elsewhere in this codebase. */
async function addVersion(packageId: string, workspaceId: string, createdBy: string, input: CreateVersionInput): Promise<DataResult<ExecutionPackage>> {
  const existing = packages.find((p) => p.id === packageId && p.workspace_id === workspaceId);
  if (!existing) return fail("This execution package could not be found.");
  if (existing.status === "archived") return fail("An archived execution package cannot receive a new version.");

  const nextVersionNumber = existing.versions.length + 1;
  const newVersion = buildVersion(packageId, workspaceId, nextVersionNumber, createdBy, input);
  const timestamp = nowIso();
  const updated: ExecutionPackage = {
    ...existing,
    status: "draft",
    current_version_id: newVersion.id,
    versions: [...existing.versions, newVersion],
    updated_at: timestamp,
    approved_at: null,
    approved_by: null,
  };
  packages = packages.map((p) => (p.id === packageId ? updated : p));
  return ok(updated);
}

async function setPackageStatus(id: string, workspaceId: string, status: ExecutionStatus, approvedBy: string | null): Promise<DataResult<ExecutionPackage>> {
  const existing = packages.find((p) => p.id === id && p.workspace_id === workspaceId);
  if (!existing) return fail("This execution package could not be found.");

  const timestamp = nowIso();
  const updated: ExecutionPackage = {
    ...existing,
    status,
    updated_at: timestamp,
    approved_at: status === "approved" ? timestamp : existing.approved_at,
    approved_by: status === "approved" ? approvedBy : existing.approved_by,
    archived_at: status === "archived" ? timestamp : null,
  };
  packages = packages.map((p) => (p.id === id ? updated : p));
  return ok(updated);
}

export interface ExecutionPackagesRepository {
  listPackagesForWorkspace: typeof listPackagesForWorkspace;
  getPackageById: typeof getPackageById;
  createPackage: typeof createPackage;
  addVersion: typeof addVersion;
  setPackageStatus: typeof setPackageStatus;
}

export const mockExecutionPackagesRepository: ExecutionPackagesRepository = {
  listPackagesForWorkspace,
  getPackageById,
  createPackage,
  addVersion,
  setPackageStatus,
};
