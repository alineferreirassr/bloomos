import type { ProposalAddon, ProposalAddonKey } from "@/types/proposalPlatform";
import { generateId, nowIso } from "@/lib/data/utils";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** v2.0 Checkpoint 33 — Add-on Engine (Step 7). 9 system add-ons ship pre-seeded, the same system-vs-custom split as `proposalTemplatesStore.ts`/`proposalPackagesStore.ts`. `transportation_placeholder` is the spec's own named placeholder — no real logistics/routing calculation backs its price, a flat quoted figure only. */

function seedAddons(): ProposalAddon[] {
  const now = nowIso();
  const base = (key: ProposalAddonKey, name: string, description: string, category: string, priceMinor: number): ProposalAddon => ({
    id: generateId("proposal_addon"),
    workspace_id: CURRENT_WORKSPACE_ID,
    key,
    name,
    description,
    category,
    price_minor: priceMinor,
    currency: "USD",
    isCustom: false,
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  return [
    base("flowers", "Flowers", "A curated floral arrangement.", "Décor", 15000),
    base("champagne", "Champagne", "A bottle of champagne with glassware.", "Beverage", 8000),
    base("drone", "Drone", "Aerial drone footage of the event.", "Media", 25000),
    base("photography", "Photography", "An add-on photography session.", "Media", 35000),
    base("videography", "Videography", "An add-on videography session.", "Media", 45000),
    base("luxury_basket", "Luxury Basket", "A curated luxury gift basket.", "Décor", 12000),
    base("live_music", "Live Music", "A live musician or small ensemble.", "Entertainment", 50000),
    base("candles", "Candles", "A styled candle arrangement.", "Décor", 6000),
    base("transportation_placeholder", "Transportation Placeholder", "A placeholder line for transportation arrangements — no routing or logistics calculation backs this figure.", "Logistics", 10000),
    base("custom_decor", "Custom Decor", "Bespoke decoration built to the client's own brief.", "Décor", 20000),
  ];
}

let addons: ProposalAddon[] = seedAddons();

export function resetProposalAddonsStore(): void {
  addons = seedAddons();
}

async function listAddons(workspaceId: string, includeArchived = false): Promise<ProposalAddon[]> {
  return addons.filter((a) => a.workspace_id === workspaceId && (includeArchived || a.archived_at === null)).sort((a, b) => a.name.localeCompare(b.name));
}

async function getAddonById(id: string): Promise<ProposalAddon | null> {
  return addons.find((a) => a.id === id) ?? null;
}

async function getAddonsByIds(ids: string[]): Promise<ProposalAddon[]> {
  const idSet = new Set(ids);
  return addons.filter((a) => idSet.has(a.id));
}

export interface CreateCustomAddonInput {
  name: string;
  description: string;
  category: string;
  price_minor: number;
  currency: string;
}

async function createCustomAddon(workspaceId: string, actor: string, input: CreateCustomAddonInput): Promise<ProposalAddon> {
  const now = nowIso();
  const addon: ProposalAddon = {
    id: generateId("proposal_addon"),
    workspace_id: workspaceId,
    key: "custom_decor",
    name: input.name,
    description: input.description,
    category: input.category,
    price_minor: input.price_minor,
    currency: input.currency,
    isCustom: true,
    created_by: actor,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  addons = [...addons, addon];
  return addon;
}

async function archiveAddon(id: string): Promise<ProposalAddon | null> {
  const existing = addons.find((a) => a.id === id);
  if (!existing || !existing.isCustom) return null;
  const updated: ProposalAddon = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  addons = addons.map((a) => (a.id === id ? updated : a));
  return updated;
}

export interface ProposalAddonsRepository {
  listAddons: typeof listAddons;
  getAddonById: typeof getAddonById;
  getAddonsByIds: typeof getAddonsByIds;
  createCustomAddon: typeof createCustomAddon;
  archiveAddon: typeof archiveAddon;
}

export const mockProposalAddonsRepository: ProposalAddonsRepository = {
  listAddons,
  getAddonById,
  getAddonsByIds,
  createCustomAddon,
  archiveAddon,
};
