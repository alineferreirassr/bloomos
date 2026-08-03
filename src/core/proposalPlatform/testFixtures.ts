import type { ProposalDraft } from "@/types/proposal";
import type { ProposalBlock, ProposalBuilderState, ProposalPricingInput, ProposalSection, ProposalSnapshot, ProposalTemplate, ProposalPackage, ProposalAddon, ProposalVersion, ProposalHeaderContent, ProposalHeroContent, ProposalFooterContent } from "@/types/proposalPlatform";
import { computeProposalPricing } from "@/core/proposalPlatform/pricingEngine";

/** v2.0 Checkpoint 33 — shared fixture builders for engine tests, mirroring Client Journey's own `testFixtures.ts` (Checkpoint 32) precedent. Not a test file itself. */

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_test_${sequence}`;
}

export function makeProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  const now = new Date().toISOString();
  return {
    id: nextId("proposal"),
    workspace_id: "ws_test",
    event_id: nextId("event"),
    client_id: nextId("client"),
    status: "draft",
    version: 1,
    parent_proposal_id: null,
    executive_summary: "A luxury picnic experience.",
    event_overview: "Sunset picnic for two.",
    services_included: [],
    timeline_summary: "2 hours on-site.",
    pricing_summary: { subtotal_minor: 65000, currency: "USD" },
    payment_terms: [],
    recommendations: [],
    optional_add_ons: [],
    questions_for_client: [],
    ai_confidence: 80,
    missing_information: [],
    provider: "mock",
    model: "mock",
    prompt_version: "v1",
    mock: true,
    generation_latency_ms: 10,
    generated_at: now,
    reviewed_by: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function makeHeader(overrides: Partial<ProposalHeaderContent> = {}): ProposalHeaderContent {
  return { title: "Your Luxury Picnic Proposal", subtitle: "Prepared exclusively for you", logoAssetId: null, ...overrides };
}

export function makeHero(overrides: Partial<ProposalHeroContent> = {}): ProposalHeroContent {
  return { headline: "An unforgettable evening awaits", subheadline: null, imageAssetId: null, ...overrides };
}

export function makeFooter(overrides: Partial<ProposalFooterContent> = {}): ProposalFooterContent {
  return { text: "Thank you for considering Amoré Bloom.", contactEmail: "hello@amorebloom.test", contactPhone: null, ...overrides };
}

export function makeBlock(overrides: Partial<ProposalBlock> = {}): ProposalBlock {
  return {
    id: nextId("proposal_block"),
    type: "paragraph",
    order: 0,
    heading: null,
    text: "Sample content.",
    mediaAssetIds: [],
    items: [],
    packageIds: [],
    tone: null,
    placeholderLabel: null,
    ...overrides,
  };
}

export function makeSection(overrides: Partial<ProposalSection> = {}): ProposalSection {
  return { id: nextId("proposal_section"), key: "whats_included", title: "What's Included", isCustom: false, blocks: [makeBlock()], ...overrides };
}

export function makePricingInput(overrides: Partial<ProposalPricingInput> = {}): ProposalPricingInput {
  return {
    currency: "USD",
    basePrice_minor: 0,
    lines: [{ kind: "package", refId: "pkg_1", label: "Luxury Picnic", unitPrice_minor: 65000, quantity: 1, isOptional: false }],
    discount: null,
    couponCode: null,
    taxRatePercent: null,
    depositPercent: 30,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<ProposalSnapshot> = {}): ProposalSnapshot {
  return {
    id: nextId("proposal_snapshot"),
    captured_at: new Date().toISOString(),
    template_id: nextId("proposal_template"),
    templateKey: "picnic_proposal",
    header: makeHeader(),
    hero: makeHero(),
    sections: [makeSection()],
    packageIds: ["pkg_1"],
    addonIds: [],
    variables: [{ key: "client_name", label: "Client Name", value: "Jordan Rivera" }],
    pricing: computeProposalPricing(makePricingInput()),
    terms: "Standard terms apply.",
    policies: "Standard cancellation policy applies.",
    footer: makeFooter(),
    ...overrides,
  };
}

export function makeVersion(overrides: Partial<ProposalVersion> = {}): ProposalVersion {
  return {
    id: nextId("proposal_version"),
    proposal_id: nextId("proposal"),
    workspace_id: "ws_test",
    version_number: 1,
    snapshot: makeSnapshot(),
    notes: null,
    reason: null,
    created_by: "member_test",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeBuilderState(overrides: Partial<ProposalBuilderState> = {}): ProposalBuilderState {
  const version = makeVersion();
  const now = new Date().toISOString();
  return {
    id: nextId("proposal_builder"),
    proposal_id: version.proposal_id,
    workspace_id: "ws_test",
    status: "draft",
    current_version_id: version.id,
    versions: [version],
    sent_at: null,
    sent_by: null,
    viewed_at: null,
    view_count: 0,
    favorited_by_client: false,
    revision_requested_at: null,
    revision_request_note: null,
    clientResponse: null,
    clientRespondedAt: null,
    archived_at: null,
    created_by: "member_test",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function makeTemplate(overrides: Partial<ProposalTemplate> = {}): ProposalTemplate {
  const now = new Date().toISOString();
  return {
    id: nextId("proposal_template"),
    workspace_id: "ws_test",
    key: "picnic_proposal",
    name: "Picnic Proposal",
    description: "A lighter template for luxury picnic bookings.",
    isSystemTemplate: true,
    structure: {
      header: makeHeader(),
      hero: makeHero(),
      sectionKeys: ["about_us", "whats_included", "payment_schedule", "terms"],
      gallery: true,
      pricing: true,
      timeline: true,
      faq: true,
      terms: true,
      policies: true,
      footer: makeFooter(),
    },
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  };
}

export function makePackage(overrides: Partial<ProposalPackage> = {}): ProposalPackage {
  const now = new Date().toISOString();
  return {
    id: nextId("proposal_package"),
    workspace_id: "ws_test",
    key: "luxury_picnic",
    name: "Luxury Picnic",
    description: "A fully styled luxury picnic setup for two.",
    category: "Picnic",
    basePrice_minor: 65000,
    currency: "USD",
    includedAddonIds: [],
    isCustom: false,
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  };
}

export function makeAddon(overrides: Partial<ProposalAddon> = {}): ProposalAddon {
  const now = new Date().toISOString();
  return {
    id: nextId("proposal_addon"),
    workspace_id: "ws_test",
    key: "flowers",
    name: "Flowers",
    description: "A curated floral arrangement.",
    category: "Décor",
    price_minor: 15000,
    currency: "USD",
    isCustom: false,
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  };
}
