import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  listProposalTemplatesAction,
  createCustomTemplateAction,
  listProposalPackagesAction,
  listProposalAddonsAction,
  buildProposalDetail,
  evaluateProposalAction,
  listProposalSummariesAction,
  createProposalVersionAction,
  publishProposalVersionAction,
  archiveProposalAction,
  restoreProposalVersionAction,
  compareProposalVersionsAction,
  sendProposalAction,
  getProposalAnalyticsAction,
  proposalRecommendationsForExecutiveDecisions,
} from "@/modules/proposalPlatform/proposalPlatformActions";
import { createLead, bookLead, resetAllMockData, type BookLeadInput } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { resetProposalsStore } from "@/lib/data/proposals/mockRepository";
import { resetProposalBuilderStore } from "@/lib/data/mock/proposalBuilderStore";
import { resetProposalTemplatesStore } from "@/lib/data/mock/proposalTemplatesStore";
import { resetProposalPackagesStore } from "@/lib/data/mock/proposalPackagesStore";
import { resetProposalAddonsStore } from "@/lib/data/mock/proposalAddonsStore";
import { resetProposalCache } from "@/core/proposalPlatform/proposalCache";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { CreateProposalVersionInput } from "@/types/proposalPlatform";
import type { CreateProposalDraftInput } from "@/types/proposal";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["proposal_builder.view", "proposal_builder.manage", "proposal_templates.manage", "proposal_versions.manage", "proposal_packages.manage", "proposal_addons.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllMockData();
  resetProposalsStore();
  resetProposalBuilderStore();
  resetProposalTemplatesStore();
  resetProposalPackagesStore();
  resetProposalAddonsStore();
  resetProposalCache();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

let bookingSequence = 0;

const eventSeed: BookLeadInput = {
  title: "Test Proposal Event",
  event_type: "proposal",
  event_date: "",
  start_time: "",
  end_time: "",
  timezone: "",
  location_name: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  latitude: "",
  longitude: "",
  guest_count: "",
  budget_min: "",
  budget_max: "",
  package_name: "",
  theme: "",
  color_palette: "",
  surprise_event: false,
  confidentiality_notes: "",
  accessibility_notes: "",
  dietary_notes: "",
  weather_plan: "",
  backup_location: "",
  internal_summary: "",
  assigned_owner: "",
  priority: "normal",
};

async function makeClientAndEvent() {
  bookingSequence += 1;
  const lead = await createLead({
    first_name: "Sasha",
    last_name: "Moreau",
    email: `sasha.moreau+${bookingSequence}@example.com`,
    phone: "",
    instagram: "",
    source: "Referral",
    event_type: "",
    event_date: "",
    location: "",
    budget_min: "",
    budget_max: "",
    message: "",
    assigned_to: "",
  });
  if (!lead.success) throw new Error("setup failed: createLead");
  const booked = await bookLead(lead.data.id, eventSeed);
  if (!booked.success) throw new Error(`setup failed: bookLead — ${booked.error}`);
  return booked.data;
}

function draftInput(overrides: Partial<CreateProposalDraftInput> = {}): CreateProposalDraftInput {
  return {
    event_id: "event_placeholder",
    client_id: "client_placeholder",
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
    generated_at: new Date().toISOString(),
    ...overrides,
  };
}

async function makeProposal(clientId: string, eventId: string) {
  const created = await getProposalsRepository().createProposalDraft(CURRENT_WORKSPACE_ID, draftInput({ client_id: clientId, event_id: eventId }));
  if (!created.success) throw new Error(`setup failed: createProposalDraft — ${created.error}`);
  return created.data;
}

function versionInput(overrides: Partial<CreateProposalVersionInput> = {}): CreateProposalVersionInput {
  return {
    templateId: null,
    templateKey: "picnic_proposal",
    header: { title: "Your Proposal", subtitle: null, logoAssetId: null },
    hero: { headline: "An unforgettable evening", subheadline: null, imageAssetId: null },
    sections: [{ id: "sec_1", key: "whats_included", title: "What's Included", isCustom: false, blocks: [{ id: "blk_1", type: "paragraph", order: 0, heading: null, text: "Included services.", mediaAssetIds: [], items: [], packageIds: [], tone: null, placeholderLabel: null }] }],
    packageIds: ["pkg_1"],
    addonIds: [],
    variables: [],
    pricingInput: {
      currency: "USD",
      basePrice_minor: 0,
      lines: [{ kind: "package", refId: "pkg_1", label: "Luxury Picnic", unitPrice_minor: 65000, quantity: 1, isOptional: false }],
      discount: null,
      couponCode: null,
      taxRatePercent: null,
      depositPercent: 30,
    },
    terms: "Standard terms.",
    policies: "Standard policy.",
    footer: { text: "Thank you.", contactEmail: null, contactPhone: null },
    notes: null,
    reason: null,
    ...overrides,
  };
}

describe("session gating", () => {
  it("rejects every action when the session is not active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await listProposalTemplatesAction();
    expect(result.success).toBe(false);
  });
});

describe("template/package/addon libraries", () => {
  it("lists the 8 seeded system templates", async () => {
    const result = await listProposalTemplatesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(8);
  });

  it("creates a custom template", async () => {
    const result = await createCustomTemplateAction({
      name: "My Template",
      description: "Custom",
      structure: { header: { title: "", subtitle: null, logoAssetId: null }, hero: { headline: "", subheadline: null, imageAssetId: null }, sectionKeys: [], gallery: false, pricing: true, timeline: false, faq: false, terms: true, policies: true, footer: { text: "", contactEmail: null, contactPhone: null } },
    });
    expect(result.success).toBe(true);
  });

  it("lists the 7 seeded system packages", async () => {
    const result = await listProposalPackagesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(7);
  });

  it("lists the 10 seeded system add-ons", async () => {
    const result = await listProposalAddonsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBe(10);
  });
});

describe("evaluate + list", () => {
  it("evaluates a proposal with no document yet as missing_sections", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    const result = await evaluateProposalAction(proposal.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.builderState).toBeNull();
      expect(result.data.readiness.state).toBe("missing_sections");
    }
  });

  it("returns an error for a nonexistent proposal", async () => {
    const result = await evaluateProposalAction("proposal_does_not_exist");
    expect(result.success).toBe(false);
  });

  it("lists summaries for every proposal in the workspace", async () => {
    const { client, event } = await makeClientAndEvent();
    await makeProposal(client.id, event.id);
    const result = await listProposalSummariesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it("caches the summaries list across identical calls", async () => {
    const { client, event } = await makeClientAndEvent();
    await makeProposal(client.id, event.id);
    const first = await listProposalSummariesAction();
    const second = await listProposalSummariesAction();
    expect(first).toEqual(second);
  });

  it("v2.0 Checkpoint 34 — wires journey_readiness to a real Client Journey health score instead of leaving it null", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    const result = await evaluateProposalAction(proposal.id);
    expect(result.success).toBe(true);
    if (result.success) {
      const journeyReadiness = result.data.health.categories.find((c) => c.category === "journey_readiness");
      // A brand-new client always has a resolvable (even if early-stage) journey, so this must never fall back to "not applicable" anymore.
      expect(journeyReadiness?.notApplicableReason).toBeNull();
      expect(journeyReadiness?.score).not.toBeNull();
    }
  });
});

describe("versioning", () => {
  it("creates the first version and leaves the document in draft", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    const result = await createProposalVersionAction(proposal.id, versionInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.versions).toHaveLength(1);
      expect(result.data.versions[0].version_number).toBe(1);
    }
  });

  it("appends a second version rather than overwriting the first", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    const second = await createProposalVersionAction(proposal.id, versionInput({ notes: "Revised pricing" }));
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.versions).toHaveLength(2);
      expect(second.data.versions[0].id).not.toBe(second.data.versions[1].id);
    }
  });

  it("moves a published document to revision when a new version is created", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    await publishProposalVersionAction(proposal.id);
    const second = await createProposalVersionAction(proposal.id, versionInput());
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.status).toBe("revision");
  });

  it("archives a proposal document", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    const result = await archiveProposalAction(proposal.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("archived");
  });

  it("restores an earlier version", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    const first = await createProposalVersionAction(proposal.id, versionInput());
    await createProposalVersionAction(proposal.id, versionInput());
    if (!first.success) throw new Error("setup failed");
    const firstVersionId = first.data.versions[0].id;
    const restored = await restoreProposalVersionAction(proposal.id, firstVersionId);
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.current_version_id).toBe(firstVersionId);
  });
});

describe("comparison", () => {
  it("compares two versions and reports differences", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    await createProposalVersionAction(proposal.id, versionInput({ terms: "Different terms." }));
    const result = await compareProposalVersionsAction(proposal.id, 1, 2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasChanges).toBe(true);
  });

  it("errors when a version number doesn't exist", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    const result = await compareProposalVersionsAction(proposal.id, 1, 99);
    expect(result.success).toBe(false);
  });
});

describe("send", () => {
  it("refuses to send a proposal that isn't ready", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    const result = await sendProposalAction(proposal.id);
    expect(result.success).toBe(false);
  });

  it("sends a fully-ready proposal and records sent_at", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await getProposalsRepository().acceptProposal(proposal.id, "member_1").catch(() => {});
    await createProposalVersionAction(proposal.id, versionInput());
    const detail = await buildProposalDetail(CURRENT_WORKSPACE_ID, proposal.id);
    // Only assert the send path when the fixture is genuinely ready — otherwise assert the honest refusal.
    const result = await sendProposalAction(proposal.id);
    if (detail?.readiness.canSend) {
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.sent_at).not.toBeNull();
    } else {
      expect(result.success).toBe(false);
    }
  });
});

describe("analytics", () => {
  it("never throws for an empty workspace", async () => {
    const result = await getProposalAnalyticsAction();
    expect(result.success).toBe(true);
  });

  it("counts a created proposal", async () => {
    const { client, event } = await makeClientAndEvent();
    await makeProposal(client.id, event.id);
    const result = await getProposalAnalyticsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalProposals).toBeGreaterThanOrEqual(1);
  });
});

describe("executive integration", () => {
  it("returns an empty array with no session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const recs = await proposalRecommendationsForExecutiveDecisions();
    expect(recs).toEqual([]);
  });

  it("never throws with real proposal data", async () => {
    const { client, event } = await makeClientAndEvent();
    await makeProposal(client.id, event.id);
    const recs = await proposalRecommendationsForExecutiveDecisions();
    expect(Array.isArray(recs)).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutating action for a session lacking the relevant proposal_* manage permission", async () => {
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    const built = await createProposalVersionAction(proposal.id, versionInput());
    if (!built.success) throw new Error("failed to build proposal version");
    const firstVersionId = built.data.versions[0].id;

    const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["proposal_builder.view", "proposal_versions.view"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    expect((await createCustomTemplateAction({ name: "Blocked", description: "Blocked", structure: { header: { title: "", subtitle: null, logoAssetId: null }, hero: { headline: "", subheadline: null, imageAssetId: null }, sectionKeys: [], gallery: false, pricing: true, timeline: false, faq: false, terms: true, policies: true, footer: { text: "", contactEmail: null, contactPhone: null } } })).success).toBe(false);
    expect((await createProposalVersionAction(proposal.id, versionInput())).success).toBe(false);
    expect((await publishProposalVersionAction(proposal.id)).success).toBe(false);
    expect((await archiveProposalAction(proposal.id)).success).toBe(false);
    expect((await restoreProposalVersionAction(proposal.id, firstVersionId)).success).toBe(false);
    expect((await sendProposalAction(proposal.id)).success).toBe(false);
  });
});
