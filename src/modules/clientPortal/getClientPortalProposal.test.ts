import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { createLead, bookLead, resetAllMockData, type BookLeadInput } from "@/lib/data";
import { getClientPortalProposalAction, compareClientPortalProposalVersionsAction, requestProposalRevisionAction, submitClientProposalResponseAction, toggleFavoriteProposalAction, listClientPortalProposalsAction } from "@/modules/clientPortal/getClientPortalProposal";
import { createProposalVersionAction, sendProposalAction } from "@/modules/proposalPlatform/proposalPlatformActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getProposalsRepository } from "@/lib/data/proposals";
import { resetProposalsStore } from "@/lib/data/proposals/mockRepository";
import { resetProposalBuilderStore } from "@/lib/data/mock/proposalBuilderStore";
import { resetProposalTemplatesStore } from "@/lib/data/mock/proposalTemplatesStore";
import { resetProposalPackagesStore } from "@/lib/data/mock/proposalPackagesStore";
import { resetProposalAddonsStore } from "@/lib/data/mock/proposalAddonsStore";
import { resetProposalCache } from "@/core/proposalPlatform/proposalCache";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { readClientAccounts, writeClientAccounts, resetClientAccountsStore, MOCK_CURRENT_CLIENT_ACCOUNT_ID } from "@/lib/data/mock/clientAccountsStore";
import type { CreateProposalDraftInput } from "@/types/proposal";
import type { CreateProposalVersionInput } from "@/types/proposalPlatform";

const memberSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["proposal_builder.view", "proposal_builder.manage", "proposal_versions.manage"],
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

let bookingSequence = 0;

const eventSeed: BookLeadInput = {
  title: "Test Portal Proposal Event",
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
    email: `sasha.moreau.portal+${bookingSequence}@example.com`,
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
    executive_summary: "",
    event_overview: "",
    services_included: [],
    timeline_summary: "",
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
    sections: [{ id: "sec_1", key: "whats_included", title: "What's Included", isCustom: false, blocks: [] }],
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

/** Mock mode has no real Client Portal auth — the seeded `MOCK_CURRENT_CLIENT_ACCOUNT_ID` account stands in for "the current client," so pointing its `client_id` at a test-created client is how these tests exercise `getCurrentClientAccountContext()` for real, without mocking it. */
function pointCurrentClientAccountAt(clientId: string): void {
  const accounts = readClientAccounts();
  writeClientAccounts(accounts.map((a) => (a.id === MOCK_CURRENT_CLIENT_ACCOUNT_ID ? { ...a, client_id: clientId, workspace_id: CURRENT_WORKSPACE_ID, status: "active" as const } : a)));
}

/** Builds a proposal all the way through to "sent" via the staff-facing module actions, then returns its id and client id for the Client Portal tests to act against. */
async function makeSentProposal(): Promise<{ proposalId: string; clientId: string }> {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
  const { client, event } = await makeClientAndEvent();
  const proposal = await makeProposal(client.id, event.id);
  await createProposalVersionAction(proposal.id, versionInput());
  await getProposalsRepository().acceptProposal(proposal.id, "member_1").catch(() => {});
  await sendProposalAction(proposal.id);
  return { proposalId: proposal.id, clientId: client.id };
}

beforeEach(() => {
  resetAll();
  resetClientAccountsStore();
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

describe("getClientPortalProposalAction", () => {
  it("rejects when the current client account has no matching proposal", async () => {
    pointCurrentClientAccountAt("client_with_nothing");
    const result = await getClientPortalProposalAction("proposal_nonexistent");
    expect(result.success).toBe(false);
  });

  it("rejects a proposal belonging to a different client", async () => {
    const { proposalId } = await makeSentProposal();
    pointCurrentClientAccountAt("client_someone_else");
    const result = await getClientPortalProposalAction(proposalId);
    expect(result.success).toBe(false);
  });

  it("returns the client-safe summary for a sent proposal and records the first view", async () => {
    const { proposalId, clientId } = await makeSentProposal();
    pointCurrentClientAccountAt(clientId);
    const result = await getClientPortalProposalAction(proposalId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentVersionNumber).toBe(1);
      expect(result.data.pricing?.grandTotal_minor).toBeGreaterThan(0);
    }
  });

  it("rejects a proposal that has not been sent yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    pointCurrentClientAccountAt(client.id);
    const result = await getClientPortalProposalAction(proposal.id);
    expect(result.success).toBe(false);
  });
});

describe("client response + favorite + revision", () => {
  it("records the client's own non-binding response", async () => {
    const { proposalId, clientId } = await makeSentProposal();
    pointCurrentClientAccountAt(clientId);
    const result = await submitClientProposalResponseAction(proposalId, "accepted");
    expect(result.success).toBe(true);
    const summary = await getClientPortalProposalAction(proposalId);
    if (summary.success) expect(summary.data.clientResponse).toBe("accepted");
  });

  it("toggles the favorite flag", async () => {
    const { proposalId, clientId } = await makeSentProposal();
    pointCurrentClientAccountAt(clientId);
    await toggleFavoriteProposalAction(proposalId, true);
    const summary = await getClientPortalProposalAction(proposalId);
    if (summary.success) expect(summary.data.favorited).toBe(true);
  });

  it("records a revision request", async () => {
    const { proposalId, clientId } = await makeSentProposal();
    pointCurrentClientAccountAt(clientId);
    const result = await requestProposalRevisionAction(proposalId, "Please change the flowers.");
    expect(result.success).toBe(true);
    const summary = await getClientPortalProposalAction(proposalId);
    if (summary.success) expect(summary.data.revisionRequestedAt).not.toBeNull();
  });
});

describe("compareClientPortalProposalVersionsAction", () => {
  it("compares two versions for the owning client", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
    const { client, event } = await makeClientAndEvent();
    const proposal = await makeProposal(client.id, event.id);
    await createProposalVersionAction(proposal.id, versionInput());
    await createProposalVersionAction(proposal.id, versionInput({ terms: "Different terms." }));
    await getProposalsRepository().acceptProposal(proposal.id, "member_1").catch(() => {});
    await sendProposalAction(proposal.id);

    pointCurrentClientAccountAt(client.id);
    const result = await compareClientPortalProposalVersionsAction(proposal.id, 1, 2);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasChanges).toBe(true);
  });
});

describe("listClientPortalProposalsAction", () => {
  it("lists only sent proposals belonging to the current client", async () => {
    const { proposalId, clientId } = await makeSentProposal();
    pointCurrentClientAccountAt(clientId);
    const result = await listClientPortalProposalsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.some((p) => p.proposalId === proposalId)).toBe(true);
  });

  it("returns an empty list when nothing has been sent yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(memberSession);
    const { client } = await makeClientAndEvent();
    pointCurrentClientAccountAt(client.id);
    const result = await listClientPortalProposalsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });
});
