import type { Document } from "@/types/document";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/core/enums/documentCategory";
import { DOCUMENT_VISIBILITIES, type DocumentVisibility } from "@/core/enums/documentVisibility";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import { EXPIRING_SOON_WINDOW_MS } from "@/core/workflows/documentWorkflow";

/**
 * Pure — no I/O, no CRUD. Single source of truth for Document counts and
 * storage totals, consumed by lib/data/index.ts's getDocumentsByOwner-style
 * summary functions and getDashboardMetrics() so no caller recomputes these
 * numbers independently and risks disagreeing. Mirrors
 * modules/contracts/contractStats.ts's computeContractStats.
 */

function isExpiringSoon(document: Document, now: number): boolean {
  if (document.status !== "active" || document.expires_at === null) return false;
  const msUntilExpiry = new Date(document.expires_at).getTime() - now;
  return msUntilExpiry > 0 && msUntilExpiry <= EXPIRING_SOON_WINDOW_MS;
}

function emptyCategoryCounts(): Record<DocumentCategory, number> {
  return Object.fromEntries(DOCUMENT_CATEGORIES.map((category) => [category, 0])) as Record<
    DocumentCategory,
    number
  >;
}

export interface DocumentOwnerSummary {
  total: number;
  active: number;
  draft: number;
  expiringSoon: number;
  expired: number;
  archived: number;
  deleted: number;
  /** Sum of size_bytes across every non-deleted Document for this owner. */
  totalStorageBytes: number;
  byCategory: Record<DocumentCategory, number>;
  /** Most recently uploaded Documents first, capped at 5. */
  latestUploads: Document[];
}

/** Summarizes every Document belonging to one owner (owner_type/owner_id already filtered by the caller — see lib/data/index.ts's getDocumentOwnerSummary). */
export function computeDocumentOwnerSummary(documents: Document[], now: number = Date.now()): DocumentOwnerSummary {
  const total = documents.length;
  const active = documents.filter((d) => d.status === "active").length;
  const draft = documents.filter((d) => d.status === "draft").length;
  const expiringSoon = documents.filter((d) => isExpiringSoon(d, now)).length;
  const expired = documents.filter((d) => d.status === "expired").length;
  const archived = documents.filter((d) => d.status === "archived").length;
  const deleted = documents.filter((d) => d.status === "deleted").length;

  const nonDeleted = documents.filter((d) => d.status !== "deleted");
  const totalStorageBytes = nonDeleted.reduce((sum, d) => sum + (d.size_bytes ?? 0), 0);

  const byCategory = emptyCategoryCounts();
  for (const document of nonDeleted) {
    byCategory[document.category] += 1;
  }

  const latestUploads = [...nonDeleted]
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
    .slice(0, 5);

  return { total, active, draft, expiringSoon, expired, archived, deleted, totalStorageBytes, byCategory, latestUploads };
}

export interface DocumentWorkspaceSummary {
  total: number;
  totalStorageBytes: number;
  expiring: number;
  expired: number;
  uploadedThisMonth: number;
  byOwnerType: Record<EntityType, number>;
  byVisibility: Record<DocumentVisibility, number>;
}

/** Summarizes every Document in a Workspace (already filtered by workspace_id by the caller). */
export function computeDocumentWorkspaceSummary(
  documents: Document[],
  now: number = Date.now(),
): DocumentWorkspaceSummary {
  const nowDate = new Date(now);
  const total = documents.length;
  const nonDeleted = documents.filter((d) => d.status !== "deleted");
  const totalStorageBytes = nonDeleted.reduce((sum, d) => sum + (d.size_bytes ?? 0), 0);
  const expiring = documents.filter((d) => isExpiringSoon(d, now)).length;
  const expired = documents.filter((d) => d.status === "expired").length;
  const uploadedThisMonth = documents.filter((d) => {
    const uploaded = new Date(d.uploaded_at);
    return (
      uploaded.getUTCFullYear() === nowDate.getUTCFullYear() && uploaded.getUTCMonth() === nowDate.getUTCMonth()
    );
  }).length;

  const byOwnerType = Object.fromEntries(ENTITY_TYPES.map((type) => [type, 0])) as Record<EntityType, number>;
  for (const document of documents) {
    byOwnerType[document.owner_type] += 1;
  }

  const byVisibility = Object.fromEntries(DOCUMENT_VISIBILITIES.map((v) => [v, 0])) as Record<
    DocumentVisibility,
    number
  >;
  for (const document of documents) {
    byVisibility[document.visibility] += 1;
  }

  return { total, totalStorageBytes, expiring, expired, uploadedThisMonth, byOwnerType, byVisibility };
}
