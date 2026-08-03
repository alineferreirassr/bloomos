import type { ProposalTemplate, ProposalTemplateKey, ProposalTemplateStructure } from "@/types/proposalPlatform";
import { generateId, nowIso } from "@/lib/data/utils";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * v2.0 Checkpoint 33 — Proposal Template Library (Step 2). 8 system
 * templates ship pre-seeded (mirroring `ChecklistTemplate`'s own
 * system-vs-custom split) so the Builder always has something to start
 * from; a workspace may also create its own `"custom_template"` entries.
 * MVP runs exactly one Workspace (`CURRENT_WORKSPACE_ID`), so system
 * templates are seeded directly against it rather than modeled as
 * cross-workspace globals.
 */

function structure(sectionKeys: ProposalTemplateStructure["sectionKeys"], overrides: Partial<ProposalTemplateStructure> = {}): ProposalTemplateStructure {
  return {
    header: { title: "", subtitle: null, logoAssetId: null },
    hero: { headline: "", subheadline: null, imageAssetId: null },
    sectionKeys,
    gallery: true,
    pricing: true,
    timeline: true,
    faq: true,
    terms: true,
    policies: true,
    footer: { text: "", contactEmail: null, contactPhone: null },
    ...overrides,
  };
}

function seedTemplates(): ProposalTemplate[] {
  const now = nowIso();
  const base = (key: ProposalTemplateKey, name: string, description: string, sectionKeys: ProposalTemplateStructure["sectionKeys"], overrides: Partial<ProposalTemplateStructure> = {}): ProposalTemplate => ({
    id: generateId("proposal_template"),
    workspace_id: CURRENT_WORKSPACE_ID,
    key,
    name,
    description,
    isSystemTemplate: true,
    structure: structure(sectionKeys, overrides),
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  return [
    base("luxury_proposal", "Luxury Proposal", "The full-experience template — every surface enabled for a high-touch, high-value event.", ["about_us", "luxury_experience", "our_process", "timeline", "whats_included", "faq", "gallery_placeholder", "payment_schedule", "terms", "policies", "cancellation"]),
    base("picnic_proposal", "Picnic Proposal", "A lighter template for luxury picnic bookings.", ["about_us", "whats_included", "timeline", "payment_schedule", "terms", "cancellation"]),
    base("hotel_decoration", "Hotel Decoration", "For in-room and hotel-venue decoration proposals.", ["about_us", "whats_included", "gallery_placeholder", "payment_schedule", "terms", "cancellation"]),
    base("proposal_event", "Proposal Event", "For marriage-proposal event staging.", ["about_us", "luxury_experience", "whats_included", "timeline", "faq", "payment_schedule", "terms", "cancellation"]),
    base("photography", "Photography", "For standalone photography bookings.", ["about_us", "whats_included", "gallery_placeholder", "payment_schedule", "terms"], { timeline: false }),
    base("ugc_services", "UGC Services", "For user-generated-content campaign bookings.", ["about_us", "whats_included", "testimonials_placeholder", "payment_schedule", "terms"], { timeline: false }),
    base("digital_services", "Digital Services", "For remote/digital deliverable engagements.", ["about_us", "whats_included", "payment_schedule", "terms"], { timeline: false, gallery: false }),
    base("general_services", "General Services", "A minimal, general-purpose starting point.", ["about_us", "whats_included", "payment_schedule", "terms"]),
  ];
}

let templates: ProposalTemplate[] = seedTemplates();

export function resetProposalTemplatesStore(): void {
  templates = seedTemplates();
}

async function listTemplates(workspaceId: string, includeArchived = false): Promise<ProposalTemplate[]> {
  return templates.filter((t) => t.workspace_id === workspaceId && (includeArchived || t.archived_at === null)).sort((a, b) => a.name.localeCompare(b.name));
}

async function getTemplateById(id: string): Promise<ProposalTemplate | null> {
  return templates.find((t) => t.id === id) ?? null;
}

export interface CreateCustomTemplateInput {
  name: string;
  description: string;
  structure: ProposalTemplateStructure;
}

async function createCustomTemplate(workspaceId: string, actor: string, input: CreateCustomTemplateInput): Promise<ProposalTemplate> {
  const now = nowIso();
  const template: ProposalTemplate = {
    id: generateId("proposal_template"),
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

async function archiveTemplate(id: string): Promise<ProposalTemplate | null> {
  const existing = templates.find((t) => t.id === id);
  if (!existing || existing.isSystemTemplate) return null;
  const updated: ProposalTemplate = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  templates = templates.map((t) => (t.id === id ? updated : t));
  return updated;
}

export interface ProposalTemplatesRepository {
  listTemplates: typeof listTemplates;
  getTemplateById: typeof getTemplateById;
  createCustomTemplate: typeof createCustomTemplate;
  archiveTemplate: typeof archiveTemplate;
}

export const mockProposalTemplatesRepository: ProposalTemplatesRepository = {
  listTemplates,
  getTemplateById,
  createCustomTemplate,
  archiveTemplate,
};
