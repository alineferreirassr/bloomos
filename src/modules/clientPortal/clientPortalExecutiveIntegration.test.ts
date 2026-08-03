import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetAllMockData, getEvents, getClients } from "@/lib/data";
import { getCoreProposalBuilderService } from "@/core/proposalPlatform";
import { getProposalsRepository } from "@/lib/data/proposals";
import { clientPortalRecommendationsForExecutiveDecisions } from "@/modules/clientPortal/clientPortalExecutiveIntegration";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { CreateProposalDraftInput } from "@/types/proposal";

function session(): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Aline Ferreira", avatar_url: null },
    workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: [],
    workspaceDisplayName: "Amoré Bloom",
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("clientPortalRecommendationsForExecutiveDecisions", () => {
  it("returns [] when there is no active member session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await clientPortalRecommendationsForExecutiveDecisions();
    expect(result).toEqual([]);
  });

  it("surfaces a pending client-requested proposal revision as a recommendation", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session());
    resetAllMockData();

    const [events, clients] = await Promise.all([getEvents(), getClients()]);
    const event = events[0];
    const client = clients[0];
    expect(event).toBeTruthy();
    expect(client).toBeTruthy();
    if (!event || !client) return;

    const draftInput: CreateProposalDraftInput = {
      event_id: event.id,
      client_id: client.id,
      parent_proposal_id: null,
      executive_summary: "Test summary",
      event_overview: "Test overview",
      services_included: [],
      timeline_summary: "Test timeline",
      pricing_summary: { subtotal_minor: 100_000, currency: "USD" },
      payment_terms: [],
      recommendations: [],
      optional_add_ons: [],
      questions_for_client: [],
      ai_confidence: 1,
      missing_information: [],
      provider: "test",
      model: "test",
      prompt_version: "v1",
      mock: true,
      generation_latency_ms: 0,
      generated_at: new Date().toISOString(),
    };
    const created = await getProposalsRepository().createProposalDraft(CURRENT_WORKSPACE_ID, draftInput);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await getCoreProposalBuilderService().getOrCreateForProposal(CURRENT_WORKSPACE_ID, created.data.id, "member_1");
    const updated = await getCoreProposalBuilderService().requestRevision(created.data.id, "Please adjust the pricing.");
    expect(updated?.revision_requested_at).toBeTruthy();

    const result = await clientPortalRecommendationsForExecutiveDecisions();
    const match = result.find((r) => r.node.nodeType === "proposal" && r.node.nodeId === created.data.id);
    expect(match).toBeTruthy();
    expect(match?.ruleId).toBe("client_portal.revision_request_waiting");
  });
});
