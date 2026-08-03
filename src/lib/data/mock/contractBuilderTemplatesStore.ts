import type { ContractBuilderTemplate, ContractBuilderTemplateKey, ContractBuilderTemplateStructure, ContractSectionKey, ContractClauseKey } from "@/types/contractPlatform";
import { generateId, nowIso } from "@/lib/data/utils";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * v2.0 Checkpoint 34 — Contract Builder Template Library (Step 2). 11
 * system templates ship pre-seeded, the same system-vs-custom split
 * `proposalTemplatesStore.ts` (Checkpoint 33) established. Distinct from
 * the real, read-only `ContractTemplate` (`types/contractTemplate.ts`) —
 * see `types/contractPlatform.ts`'s own top-level doc comment for why.
 */

function structure(sectionKeys: ContractSectionKey[], defaultClauseKeys: ContractClauseKey[], optionalClauseKeys: ContractClauseKey[]): ContractBuilderTemplateStructure {
  return {
    header: { title: "", subtitle: null, logoAssetId: null },
    sectionKeys,
    defaultClauseKeys,
    optionalClauseKeys,
    hasSignaturePlaceholders: true,
    footer: { text: "", contactEmail: null, contactPhone: null },
  };
}

const STANDARD_SECTIONS: ContractSectionKey[] = ["parties", "scope_of_services", "payment_terms", "clauses", "signatures"];
const FULL_SECTIONS: ContractSectionKey[] = ["parties", "recitals", "scope_of_services", "payment_terms", "term_and_termination", "clauses", "signatures"];

function seedTemplates(): ContractBuilderTemplate[] {
  const now = nowIso();
  const base = (key: ContractBuilderTemplateKey, name: string, description: string, sectionKeys: ContractSectionKey[], defaultClauseKeys: ContractClauseKey[], optionalClauseKeys: ContractClauseKey[]): ContractBuilderTemplate => ({
    id: generateId("contract_builder_template"),
    workspace_id: CURRENT_WORKSPACE_ID,
    key,
    name,
    description,
    isSystemTemplate: true,
    structure: structure(sectionKeys, defaultClauseKeys, optionalClauseKeys),
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  return [
    base("master_service_agreement", "Master Service Agreement", "A general-purpose services agreement covering the full commercial relationship.", FULL_SECTIONS, ["payment_terms", "cancellation_policy", "liability", "confidentiality", "force_majeure"], ["intellectual_property", "late_payment"]),
    base("proposal_agreement", "Proposal Agreement", "For converting an accepted Proposal into a signable agreement.", STANDARD_SECTIONS, ["payment_terms", "cancellation_policy", "refund_policy"], ["reschedule_policy"]),
    base("picnic_agreement", "Picnic Agreement", "For luxury picnic bookings.", STANDARD_SECTIONS, ["payment_terms", "cancellation_policy", "damage_policy"], ["photo_release", "video_release", "reschedule_policy"]),
    base("hotel_decoration_agreement", "Hotel Decoration Agreement", "For in-room and hotel-venue decoration services.", STANDARD_SECTIONS, ["payment_terms", "cancellation_policy", "damage_policy", "liability"], ["travel_policy"]),
    base("photography_agreement", "Photography Agreement", "For standalone photography bookings.", STANDARD_SECTIONS, ["payment_terms", "photo_release", "cancellation_policy"], ["video_release", "intellectual_property"]),
    base("ugc_agreement", "UGC Agreement", "For user-generated-content campaign bookings.", STANDARD_SECTIONS, ["payment_terms", "intellectual_property", "video_release"], ["photo_release", "confidentiality"]),
    base("vendor_agreement", "Vendor Agreement", "For engaging an outside vendor.", FULL_SECTIONS, ["payment_terms", "liability", "confidentiality", "force_majeure"], ["late_payment", "intellectual_property"]),
    base("independent_contractor", "Independent Contractor", "For engaging an independent contractor.", FULL_SECTIONS, ["payment_terms", "confidentiality", "liability", "intellectual_property"], ["late_payment"]),
    base("nda", "NDA", "A standalone non-disclosure agreement.", ["parties", "recitals", "clauses", "term_and_termination", "signatures"], ["confidentiality", "privacy"], ["intellectual_property"]),
    base("employment_agreement", "Employment Agreement", "For a direct employment relationship.", FULL_SECTIONS, ["confidentiality", "liability", "privacy"], ["intellectual_property", "late_payment"]),
    base("custom_template", "General Template", "A minimal, general-purpose starting point.", ["parties", "scope_of_services", "clauses", "signatures"], ["payment_terms"], []),
  ];
}

let templates: ContractBuilderTemplate[] = seedTemplates();

export function resetContractBuilderTemplatesStore(): void {
  templates = seedTemplates();
}

async function listTemplates(workspaceId: string, includeArchived = false): Promise<ContractBuilderTemplate[]> {
  return templates.filter((t) => t.workspace_id === workspaceId && (includeArchived || t.archived_at === null)).sort((a, b) => a.name.localeCompare(b.name));
}

async function getTemplateById(id: string): Promise<ContractBuilderTemplate | null> {
  return templates.find((t) => t.id === id) ?? null;
}

export interface CreateCustomContractTemplateInput {
  name: string;
  description: string;
  structure: ContractBuilderTemplateStructure;
}

async function createCustomTemplate(workspaceId: string, actor: string, input: CreateCustomContractTemplateInput): Promise<ContractBuilderTemplate> {
  const now = nowIso();
  const template: ContractBuilderTemplate = {
    id: generateId("contract_builder_template"),
    workspace_id: workspaceId,
    key: "custom_template",
    name: input.name,
    description: input.description,
    isSystemTemplate: false,
    structure: input.structure,
    created_by: actor,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  templates = [...templates, template];
  return template;
}

async function archiveTemplate(id: string): Promise<ContractBuilderTemplate | null> {
  const existing = templates.find((t) => t.id === id);
  if (!existing || existing.isSystemTemplate) return null;
  const updated: ContractBuilderTemplate = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  templates = templates.map((t) => (t.id === id ? updated : t));
  return updated;
}

export interface ContractBuilderTemplatesRepository {
  listTemplates: typeof listTemplates;
  getTemplateById: typeof getTemplateById;
  createCustomTemplate: typeof createCustomTemplate;
  archiveTemplate: typeof archiveTemplate;
}

export const mockContractBuilderTemplatesRepository: ContractBuilderTemplatesRepository = {
  listTemplates,
  getTemplateById,
  createCustomTemplate,
  archiveTemplate,
};
