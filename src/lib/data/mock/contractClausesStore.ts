import type { ContractClause, ContractClauseKey } from "@/types/contractPlatform";
import { generateId, nowIso } from "@/lib/data/utils";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * v2.0 Checkpoint 34 — Clause Library (Step 4). 14 system clauses ship
 * pre-seeded — no clause data model existed anywhere in this codebase
 * before this checkpoint (confirmed: `journeyRequirementsEngine.ts`'s own
 * comment discloses "Contract has no dedicated clause list... a
 * non-empty `description` is treated as clauses present," a proxy this
 * checkpoint now supersedes with a real library). `bodyText` may itself
 * contain `{{variable}}` placeholders — the Variable Engine
 * (`core/contractPlatform/variableEngine.ts`) substitutes into clause
 * text exactly like any other block.
 */

function seedClauses(): ContractClause[] {
  const now = nowIso();
  const base = (key: ContractClauseKey, name: string, category: string, bodyText: string, isOptional: boolean): ContractClause => ({
    id: generateId("contract_clause"),
    workspace_id: CURRENT_WORKSPACE_ID,
    key,
    name,
    category,
    bodyText,
    isOptional,
    isCustom: false,
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  return [
    base("payment_terms", "Payment Terms", "Financial", "{{client_name}} agrees to pay {{proposal_total}}, with a deposit of {{deposit}} due upon signing and the remaining balance of {{remaining_balance}} due prior to {{event_date}}.", false),
    base("cancellation_policy", "Cancellation Policy", "Policy", "Cancellations must be submitted in writing. Deposits are non-refundable once services have been reserved.", false),
    base("reschedule_policy", "Reschedule Policy", "Policy", "Rescheduling is permitted once, subject to availability, with at least 14 days' written notice.", true),
    base("refund_policy", "Refund Policy", "Financial", "Refunds, where applicable, will be issued to the original payment method within 14 business days of approval.", true),
    base("force_majeure", "Force Majeure", "Legal", "Neither party is liable for delay or failure to perform due to causes beyond its reasonable control, including natural disasters, government action, or public health emergencies.", false),
    base("privacy", "Privacy", "Legal", "Personal information collected under this agreement will be used solely to fulfill the services described herein.", false),
    base("confidentiality", "Confidentiality", "Legal", "Each party agrees to keep confidential any non-public information disclosed by the other party in connection with this agreement.", false),
    base("liability", "Liability", "Legal", "{{company_name}}'s total liability under this agreement is limited to the total value paid under this agreement.", false),
    base("intellectual_property", "Intellectual Property", "Legal", "All creative work product produced under this agreement remains the intellectual property of {{company_name}} unless otherwise agreed in writing.", true),
    base("photo_release", "Photo Release", "Media", "{{client_name}} grants {{company_name}} permission to use photographs taken during the event for portfolio and marketing purposes.", true),
    base("video_release", "Video Release", "Media", "{{client_name}} grants {{company_name}} permission to use video footage taken during the event for portfolio and marketing purposes.", true),
    base("travel_policy", "Travel Policy", "Logistics", "Travel beyond a standard service radius may incur an additional fee, to be disclosed prior to booking confirmation.", true),
    base("damage_policy", "Damage Policy", "Financial", "{{client_name}} is responsible for any damage to equipment or property caused by guests during the event.", true),
    base("late_payment", "Late Payment", "Financial", "Payments not received by the due date may be subject to a late fee and may result in delay or suspension of services.", true),
  ];
}

let clauses: ContractClause[] = seedClauses();

export function resetContractClausesStore(): void {
  clauses = seedClauses();
}

async function listClauses(workspaceId: string, includeArchived = false): Promise<ContractClause[]> {
  return clauses.filter((c) => c.workspace_id === workspaceId && (includeArchived || c.archived_at === null)).sort((a, b) => a.name.localeCompare(b.name));
}

async function getClauseById(id: string): Promise<ContractClause | null> {
  return clauses.find((c) => c.id === id) ?? null;
}

async function getClausesByIds(ids: string[]): Promise<ContractClause[]> {
  const idSet = new Set(ids);
  return clauses.filter((c) => idSet.has(c.id));
}

export interface CreateCustomClauseInput {
  name: string;
  category: string;
  bodyText: string;
  isOptional: boolean;
}

async function createCustomClause(workspaceId: string, actor: string, input: CreateCustomClauseInput): Promise<ContractClause> {
  const now = nowIso();
  const clause: ContractClause = {
    id: generateId("contract_clause"),
    workspace_id: workspaceId,
    key: "custom_clause",
    name: input.name,
    category: input.category,
    bodyText: input.bodyText,
    isOptional: input.isOptional,
    isCustom: true,
    created_by: actor,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  clauses = [...clauses, clause];
  return clause;
}

async function archiveClause(id: string): Promise<ContractClause | null> {
  const existing = clauses.find((c) => c.id === id);
  if (!existing || !existing.isCustom) return null;
  const updated: ContractClause = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  clauses = clauses.map((c) => (c.id === id ? updated : c));
  return updated;
}

export interface ContractClausesRepository {
  listClauses: typeof listClauses;
  getClauseById: typeof getClauseById;
  getClausesByIds: typeof getClausesByIds;
  createCustomClause: typeof createCustomClause;
  archiveClause: typeof archiveClause;
}

export const mockContractClausesRepository: ContractClausesRepository = {
  listClauses,
  getClauseById,
  getClausesByIds,
  createCustomClause,
  archiveClause,
};
