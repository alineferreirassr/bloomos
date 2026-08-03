import type { ProposalPackage, ProposalPackageKey } from "@/types/proposalPlatform";
import { generateId, nowIso } from "@/lib/data/utils";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** v2.0 Checkpoint 33 — Package Builder (Step 6). 7 system packages ship pre-seeded, the same system-vs-custom split as `proposalTemplatesStore.ts`. */

function seedPackages(): ProposalPackage[] {
  const now = nowIso();
  const base = (key: ProposalPackageKey, name: string, description: string, category: string, basePriceMinor: number): ProposalPackage => ({
    id: generateId("proposal_package"),
    workspace_id: CURRENT_WORKSPACE_ID,
    key,
    name,
    description,
    category,
    basePrice_minor: basePriceMinor,
    currency: "USD",
    includedAddonIds: [],
    isCustom: false,
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  return [
    base("luxury_picnic", "Luxury Picnic", "A fully styled luxury picnic setup for two.", "Picnic", 65000),
    base("beach_proposal", "Beach Proposal", "A beachfront proposal setup with décor and seating.", "Proposal", 120000),
    base("birthday", "Birthday", "A styled birthday celebration setup.", "Celebration", 85000),
    base("hotel_decoration", "Hotel Decoration", "In-room decoration package for hotel stays.", "Decoration", 45000),
    base("photography", "Photography", "A dedicated photography session package.", "Photography", 55000),
    base("ugc_campaign", "UGC Campaign", "A short-form UGC content campaign package.", "Content", 75000),
    base("digital_package", "Digital Package", "A fully remote/digital deliverable package.", "Digital", 25000),
  ];
}

let packages: ProposalPackage[] = seedPackages();

export function resetProposalPackagesStore(): void {
  packages = seedPackages();
}

async function listPackages(workspaceId: string, includeArchived = false): Promise<ProposalPackage[]> {
  return packages.filter((p) => p.workspace_id === workspaceId && (includeArchived || p.archived_at === null)).sort((a, b) => a.name.localeCompare(b.name));
}

async function getPackageById(id: string): Promise<ProposalPackage | null> {
  return packages.find((p) => p.id === id) ?? null;
}

async function getPackagesByIds(ids: string[]): Promise<ProposalPackage[]> {
  const idSet = new Set(ids);
  return packages.filter((p) => idSet.has(p.id));
}

export interface CreateCustomPackageInput {
  name: string;
  description: string;
  category: string;
  basePrice_minor: number;
  currency: string;
  includedAddonIds: string[];
}

async function createCustomPackage(workspaceId: string, actor: string, input: CreateCustomPackageInput): Promise<ProposalPackage> {
  const now = nowIso();
  const pkg: ProposalPackage = {
    id: generateId("proposal_package"),
    workspace_id: workspaceId,
    key: "custom_package",
    name: input.name,
    description: input.description,
    category: input.category,
    basePrice_minor: input.basePrice_minor,
    currency: input.currency,
    includedAddonIds: input.includedAddonIds,
    isCustom: true,
    created_by: actor,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  packages = [...packages, pkg];
  return pkg;
}

async function archivePackage(id: string): Promise<ProposalPackage | null> {
  const existing = packages.find((p) => p.id === id);
  if (!existing || !existing.isCustom) return null;
  const updated: ProposalPackage = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  packages = packages.map((p) => (p.id === id ? updated : p));
  return updated;
}

export interface ProposalPackagesRepository {
  listPackages: typeof listPackages;
  getPackageById: typeof getPackageById;
  getPackagesByIds: typeof getPackagesByIds;
  createCustomPackage: typeof createCustomPackage;
  archivePackage: typeof archivePackage;
}

export const mockProposalPackagesRepository: ProposalPackagesRepository = {
  listPackages,
  getPackageById,
  getPackagesByIds,
  createCustomPackage,
  archivePackage,
};
