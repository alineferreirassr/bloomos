import type { SearchProvider, SearchQuery, SearchResult } from "@/core/search/types";
import { getSearchableEntityConfig } from "@/core/search/registry";
import {
  getClients,
  getContracts,
  getDocuments,
  getEvents,
  getExpenses,
  getInvoices,
  getLeads,
  getPayments,
  getVendors,
  getWorkspaceMembers,
  listInventoryItems,
  listMediaAssetsForWorkspace,
  listPurchases,
} from "@/lib/data";
import type { EntityType } from "@/core/enums/entityType";
import type { Client } from "@/types/client";
import type { Contract } from "@/types/contract";
import type { Document } from "@/types/document";
import type { Event } from "@/types/event";
import type { Expense } from "@/types/expense";
import type { InventoryItem } from "@/types/inventoryItem";
import type { Invoice } from "@/types/invoice";
import type { Lead } from "@/types/lead";
import type { MediaAsset } from "@/types/mediaAsset";
import type { Payment } from "@/types/payment";
import type { Purchase } from "@/types/purchase";
import type { TeamMember } from "@/types/teamMember";
import type { Vendor } from "@/types/vendor";
import { getCoreDecisionsService } from "@/core/executiveDecisions";
import { getCoreObjectivesService } from "@/core/objectives";
import { getCoreDispatchOrdersService } from "@/core/dispatch";
import { getCoreRouteOptimizationService } from "@/core/routeOptimization";
import { getCoreOperationalPlansService } from "@/core/operationalPlanning";
import { getCoreExecutionPackagesService } from "@/core/executionPackage";
import { getCoreResourceBundlesService } from "@/core/allocation";
import { getWorkflowManager } from "@/core/workflow/manager";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getCoreWorkersService, getCoreTeamsService, getCoreEquipmentService, getCoreVehiclesService } from "@/core/workforce";

/**
 * v2.0 Checkpoint 38, Step 3 — the real `SearchProvider` this codebase's
 * own `core/search/types.ts` doc comment anticipated: "a real one...
 * slots in later by implementing this same interface." Until this file,
 * `getActiveSearchProvider()` always returned `nullSearchProvider`
 * (confirmed via repo-wide grep — `setActiveSearchProvider` was never
 * called anywhere), so the Command Palette's own search box
 * (`CommandPalette.tsx`) and Bloom AI's Copilot panel search
 * (`CopilotPanel.tsx`) — both already wired to call `runSearch()` — were
 * silently returning zero results in the running app. Registering this
 * provider (`core/initializeCore.ts`) doesn't just power the new
 * Workspace Global Search widget; it makes those two pre-existing search
 * boxes work for the first time.
 *
 * Unlike the rest of `core/workspace`'s pure engines, this file
 * intentionally performs I/O — `SearchProvider.search()` is defined as
 * `Promise<SearchResult[]>` by its own interface contract (the "how" layer
 * behind `core/search/registry.ts`'s "what's searchable"), the same as any
 * future real index/service implementation would.
 *
 * Fans out to per-entity list functions per `EntityType` — never a second
 * search index, never new business logic, just term-matching over records
 * every module's own repository function already returns.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Same three-tier scoring convention as `core/settings/search.ts`'s own `scoreMatch` — exact match highest, prefix next, substring last. */
function scoreTitleMatch(term: string, title: string): number {
  const normalizedTitle = normalize(title);
  if (normalizedTitle === term) return 100;
  if (normalizedTitle.startsWith(term)) return 90;
  if (normalizedTitle.includes(term)) return 70;
  return 0;
}

interface Candidate {
  entityId: string;
  title: string;
  snippet?: string;
}

async function searchLeads(workspaceId: string): Promise<Candidate[]> {
  const leads: Lead[] = await getLeads();
  return leads.filter((l) => l.workspace_id === workspaceId).map((l) => ({ entityId: l.id, title: `${l.first_name} ${l.last_name}`, snippet: l.email }));
}

async function searchClients(workspaceId: string): Promise<Candidate[]> {
  const clients: Client[] = await getClients();
  return clients.filter((c) => c.workspace_id === workspaceId).map((c) => ({ entityId: c.id, title: `${c.first_name} ${c.last_name}`, snippet: c.email }));
}

async function searchEvents(workspaceId: string): Promise<Candidate[]> {
  const events: Event[] = await getEvents();
  return events.filter((e) => e.workspace_id === workspaceId).map((e) => ({ entityId: e.id, title: e.title, snippet: e.location_name ?? undefined }));
}

async function searchContracts(workspaceId: string): Promise<Candidate[]> {
  const contracts: Contract[] = await getContracts();
  return contracts.filter((c) => c.workspace_id === workspaceId).map((c) => ({ entityId: c.id, title: c.title, snippet: c.contract_number }));
}

async function searchInvoices(workspaceId: string): Promise<Candidate[]> {
  const invoices: Invoice[] = await getInvoices();
  return invoices.filter((i) => i.workspace_id === workspaceId).map((i) => ({ entityId: i.id, title: i.title, snippet: i.invoice_number }));
}

async function searchDocuments(workspaceId: string): Promise<Candidate[]> {
  const documents: Document[] = await getDocuments({});
  return documents.filter((d) => d.workspace_id === workspaceId).map((d) => ({ entityId: d.id, title: d.title, snippet: d.description ?? undefined }));
}

async function searchMediaAssets(workspaceId: string): Promise<Candidate[]> {
  const assets: MediaAsset[] = await listMediaAssetsForWorkspace(workspaceId);
  return assets.map((a) => ({ entityId: a.id, title: a.original_filename, snippet: a.mime_type }));
}

async function searchTeamMembers(workspaceId: string): Promise<Candidate[]> {
  const members: TeamMember[] = await getWorkspaceMembers();
  return members.filter((m) => m.workspace_id === workspaceId && m.full_name).map((m) => ({ entityId: m.id, title: m.full_name as string, snippet: m.email }));
}

async function searchVendors(workspaceId: string): Promise<Candidate[]> {
  const vendors: Vendor[] = await getVendors();
  return vendors.filter((v) => v.workspace_id === workspaceId).map((v) => ({ entityId: v.id, title: v.display_name ?? v.company_name, snippet: v.company_name }));
}

// ---------------------------------------------------------------------------
// v2.0 Checkpoint 40 — Global Search & Universal Command Center. Four of
// these (`payment`/`expense`/`inventory_item`/`purchase`) were already
// registered as searchable in `defaultRegistrations.ts` since Checkpoint 38
// but never had a fetcher here — a real gap Checkpoint 40's own audit
// surfaced, not a new decision. The rest fill the eight `EntityType` values
// this checkpoint added (see `core/enums/entityType.ts`'s own comment).
// ---------------------------------------------------------------------------

async function searchPayments(workspaceId: string): Promise<Candidate[]> {
  const payments: Payment[] = await getPayments();
  return payments.filter((p) => p.workspace_id === workspaceId).map((p) => ({ entityId: p.id, title: p.reference ?? `${p.payment_type} payment`, snippet: p.payment_method }));
}

async function searchExpenses(workspaceId: string): Promise<Candidate[]> {
  const expenses: Expense[] = await getExpenses();
  return expenses.filter((e) => e.workspace_id === workspaceId).map((e) => ({ entityId: e.id, title: e.description, snippet: e.category }));
}

async function searchInventoryItems(workspaceId: string): Promise<Candidate[]> {
  const items: InventoryItem[] = await listInventoryItems();
  return items.filter((i) => i.workspace_id === workspaceId).map((i) => ({ entityId: i.id, title: i.name, snippet: i.sku ?? undefined }));
}

async function searchPurchases(workspaceId: string): Promise<Candidate[]> {
  const purchases: Purchase[] = await listPurchases();
  return purchases.filter((p) => p.workspace_id === workspaceId).map((p) => ({ entityId: p.id, title: p.purchase_number, snippet: p.status }));
}

/**
 * Neither `ProposalDraft` nor the newer Proposal Platform's own summary
 * shape carries a title field — the exact gap `docs/smart-workspace.md`
 * already disclosed. Joining to the linked Event's own `title` is the same
 * honest-derivation precedent `searchLeads`/`searchClients` already use
 * (concatenating first/last name rather than inventing a display field
 * neither type has). Reads `getProposalsRepository()` directly — never
 * `proposalPlatformActions.ts`'s own Server Actions, which pull in
 * `resolveMemberSessionSnapshot()`'s Supabase-server import chain and would
 * violate the same client/server boundary every other candidate fetcher in
 * this file avoids by reading `lib/data` directly.
 */
async function searchProposals(workspaceId: string): Promise<Candidate[]> {
  const proposals = await getProposalsRepository().getRecentProposals(workspaceId, 500);

  const events: Event[] = await getEvents();
  const eventTitleById = new Map(events.filter((e) => e.workspace_id === workspaceId).map((e) => [e.id, e.title]));

  return proposals.map((p) => ({
    entityId: p.id,
    title: eventTitleById.get(p.event_id) ? `Proposal — ${eventTitleById.get(p.event_id)}` : "Proposal",
    snippet: p.status,
  }));
}

async function searchWorkflows(workspaceId: string): Promise<Candidate[]> {
  const workflows = await getWorkflowManager().listWorkflows(workspaceId);
  return workflows.map((w) => ({ entityId: w.id, title: w.metadata.name, snippet: w.metadata.description || undefined }));
}

async function searchDecisions(workspaceId: string): Promise<Candidate[]> {
  const decisions = await getCoreDecisionsService().listDecisionsForWorkspace(workspaceId, false);
  return decisions.map((d) => ({ entityId: d.id, title: d.title, snippet: d.category }));
}

async function searchObjectives(workspaceId: string): Promise<Candidate[]> {
  const objectives = await getCoreObjectivesService().listObjectivesForWorkspace(workspaceId, false);
  return objectives.map((o) => ({ entityId: o.id, title: o.title, snippet: o.description ?? undefined }));
}

/** `DispatchOrder` has no title/name field of its own — a real, honest label built from its own status/priority, the same "readable but not fabricated" discipline `docs/workflow-monitoring.md`'s Error Center "stack" field already established for a value that genuinely doesn't exist as free text. */
async function searchDispatchOrders(workspaceId: string): Promise<Candidate[]> {
  const orders = await getCoreDispatchOrdersService().listOrdersForWorkspace(workspaceId, false);
  return orders.map((o) => ({ entityId: o.id, title: `Dispatch Order — ${o.status.replace(/_/g, " ")}`, snippet: o.priority }));
}

/** `RoutePlan` has no title/name field either — same synthetic-but-honest label as `searchDispatchOrders`. */
async function searchRoutePlans(workspaceId: string): Promise<Candidate[]> {
  const plans = await getCoreRouteOptimizationService().listRoutePlansForWorkspace(workspaceId, false);
  return plans.map((p) => ({ entityId: p.id, title: `Route Plan — ${p.status.replace(/_/g, " ")}`, snippet: p.priority }));
}

async function searchOperationalPlans(workspaceId: string): Promise<Candidate[]> {
  const plans = await getCoreOperationalPlansService().listPlansForWorkspace(workspaceId, false);
  return plans.map((p) => ({ entityId: p.id, title: p.name, snippet: p.status }));
}

async function searchExecutionPackages(workspaceId: string): Promise<Candidate[]> {
  const packages = await getCoreExecutionPackagesService().listPackagesForWorkspace(workspaceId, false);
  return packages.map((p) => ({ entityId: p.id, title: p.metadata.title, snippet: p.status }));
}

async function searchResourceBundles(workspaceId: string): Promise<Candidate[]> {
  const bundles = await getCoreResourceBundlesService().listBundlesForWorkspace(workspaceId, false);
  return bundles.map((b) => ({ entityId: b.id, title: b.name, snippet: b.description ?? undefined }));
}

/**
 * Checkpoint 45A — Worker/Team/Equipment/Vehicle have been real `EntityType`s
 * and Knowledge Graph nodes since Checkpoint 26 (see `entityType.ts`'s own
 * comment) but were never given a fetcher here, an undisclosed gap the
 * Checkpoint 45 Step 0 audit surfaced. Same fan-out-to-existing-repository
 * precedent every other fetcher in this file already uses — no new store,
 * no new business logic.
 */
async function searchWorkers(workspaceId: string): Promise<Candidate[]> {
  const workers = await getCoreWorkersService().listWorkersForWorkspace(workspaceId, false);
  return workers.map((w) => ({ entityId: w.id, title: `${w.first_name} ${w.last_name}`, snippet: w.email }));
}

async function searchTeams(workspaceId: string): Promise<Candidate[]> {
  const teams = await getCoreTeamsService().listTeamsForWorkspace(workspaceId, false);
  return teams.map((t) => ({ entityId: t.id, title: t.name, snippet: t.description ?? undefined }));
}

async function searchEquipment(workspaceId: string): Promise<Candidate[]> {
  const equipment = await getCoreEquipmentService().listEquipmentForWorkspace(workspaceId, false);
  return equipment.map((e) => ({ entityId: e.id, title: e.name, snippet: e.category }));
}

async function searchVehicles(workspaceId: string): Promise<Candidate[]> {
  const vehicles = await getCoreVehiclesService().listVehiclesForWorkspace(workspaceId, false);
  return vehicles.map((v) => ({ entityId: v.id, title: v.label, snippet: v.vehicle_type }));
}

const CANDIDATE_FETCHERS: Partial<Record<EntityType, (workspaceId: string) => Promise<Candidate[]>>> = {
  lead: searchLeads,
  client: searchClients,
  event: searchEvents,
  contract: searchContracts,
  invoice: searchInvoices,
  document: searchDocuments,
  media_asset: searchMediaAssets,
  team_member: searchTeamMembers,
  vendor: searchVendors,
  payment: searchPayments,
  expense: searchExpenses,
  inventory_item: searchInventoryItems,
  purchase: searchPurchases,
  proposal: searchProposals,
  workflow: searchWorkflows,
  decision: searchDecisions,
  objective: searchObjectives,
  dispatch_order: searchDispatchOrders,
  route_plan: searchRoutePlans,
  operational_plan: searchOperationalPlans,
  execution_package: searchExecutionPackages,
  resource_bundle: searchResourceBundles,
  worker: searchWorkers,
  team: searchTeams,
  equipment: searchEquipment,
  vehicle: searchVehicles,
};

const DEFAULT_ROUTES: Partial<Record<EntityType, (id: string) => string>> = {
  media_asset: (id) => `/assets/${id}`,
  team_member: () => `/team`,
};

export const workspaceSearchProvider: SearchProvider = {
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const term = normalize(query.term);
    if (!term) return [];

    const entityTypes = query.entityTypes ?? (Object.keys(CANDIDATE_FETCHERS) as EntityType[]);
    const results: SearchResult[] = [];

    await Promise.all(
      entityTypes.map(async (entityType) => {
        const fetcher = CANDIDATE_FETCHERS[entityType];
        if (!fetcher) return;

        const candidates = await fetcher(query.workspaceId);
        const config = getSearchableEntityConfig(entityType);
        const route = config?.route ?? DEFAULT_ROUTES[entityType];
        if (!route) return;

        for (const candidate of candidates) {
          const score = scoreTitleMatch(term, candidate.title);
          const snippetMatches = candidate.snippet ? normalize(candidate.snippet).includes(term) : false;
          if (score === 0 && !snippetMatches) continue;

          results.push({
            entityType,
            entityId: candidate.entityId,
            title: candidate.title,
            snippet: candidate.snippet,
            route: route(candidate.entityId),
            score: score === 0 ? 20 : score,
          });
        }
      }),
    );

    return results;
  },
};
