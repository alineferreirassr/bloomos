import { afterEach, describe, expect, it } from "vitest";
import { mockProposalsRepository, resetProposalsStore } from "@/lib/data/proposals/mockRepository";
import type { CreateProposalDraftInput } from "@/types/proposal";

function makeInput(overrides: Partial<CreateProposalDraftInput> = {}): CreateProposalDraftInput {
  return {
    event_id: "event_1",
    client_id: "client_1",
    parent_proposal_id: null,
    executive_summary: "A summary.",
    event_overview: "An overview.",
    services_included: [],
    timeline_summary: "No schedule yet.",
    pricing_summary: { subtotal_minor: 0, currency: "USD" },
    payment_terms: [],
    recommendations: [],
    optional_add_ons: [],
    questions_for_client: [],
    ai_confidence: 80,
    missing_information: [],
    provider: "mock",
    model: "bloomos-mock-proposal-v1",
    prompt_version: "proposal-generator-v1",
    mock: true,
    generation_latency_ms: 10,
    generated_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("mockProposalsRepository", () => {
  afterEach(() => resetProposalsStore());

  it("creates the first draft at version 1 with status 'draft'", async () => {
    const result = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(1);
      expect(result.data.status).toBe("draft");
      expect(result.data.parent_proposal_id).toBeNull();
    }
  });

  it("regenerating supersedes the referenced draft parent and continues the version chain", async () => {
    const first = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    if (!first.success) throw new Error("setup failed");

    const second = await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ parent_proposal_id: first.data.id }));
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.version).toBe(2);
      expect(second.data.parent_proposal_id).toBe(first.data.id);
    }

    const supersededParent = await mockProposalsRepository.getProposalById(first.data.id);
    expect(supersededParent?.status).toBe("superseded");
  });

  it("continues the version chain even without a parent id (e.g. Generate again after a rejection)", async () => {
    const first = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    if (!first.success) throw new Error("setup failed");
    await mockProposalsRepository.rejectProposal(first.data.id, "user_1");

    const second = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.version).toBe(2);

    const original = await mockProposalsRepository.getProposalById(first.data.id);
    expect(original?.status).toBe("rejected"); // never silently overturned by a fresh generation with no parent
  });

  it("fails to regenerate against a parent id that no longer exists", async () => {
    const result = await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ parent_proposal_id: "missing" }));
    expect(result.success).toBe(false);
  });

  it("does not supersede an already-accepted parent when a new draft references it", async () => {
    const first = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    if (!first.success) throw new Error("setup failed");
    await mockProposalsRepository.acceptProposal(first.data.id, "user_1");

    await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ parent_proposal_id: first.data.id }));

    const accepted = await mockProposalsRepository.getProposalById(first.data.id);
    expect(accepted?.status).toBe("accepted");
  });

  describe("acceptProposal / rejectProposal", () => {
    it("accepting sets status and reviewer fields", async () => {
      const created = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
      if (!created.success) throw new Error("setup failed");

      const accepted = await mockProposalsRepository.acceptProposal(created.data.id, "reviewer_1");
      expect(accepted.success).toBe(true);
      if (accepted.success) {
        expect(accepted.data.status).toBe("accepted");
        expect(accepted.data.reviewed_by).toBe("reviewer_1");
        expect(accepted.data.reviewed_at).not.toBeNull();
      }
    });

    it("rejecting sets status to rejected", async () => {
      const created = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
      if (!created.success) throw new Error("setup failed");

      const rejected = await mockProposalsRepository.rejectProposal(created.data.id, "reviewer_1");
      expect(rejected.success).toBe(true);
      if (rejected.success) expect(rejected.data.status).toBe("rejected");
    });

    it("fails to accept a proposal that isn't in draft status", async () => {
      const created = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
      if (!created.success) throw new Error("setup failed");
      await mockProposalsRepository.acceptProposal(created.data.id, "reviewer_1");

      const result = await mockProposalsRepository.acceptProposal(created.data.id, "reviewer_2");
      expect(result.success).toBe(false);
    });

    it("fails for a nonexistent id", async () => {
      const result = await mockProposalsRepository.acceptProposal("missing", "reviewer_1");
      expect(result.success).toBe(false);
    });
  });

  describe("getProposalsByEvent / getLatestProposalForEvent", () => {
    it("returns the full chain sorted newest-version-first", async () => {
      const first = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
      if (!first.success) throw new Error("setup failed");
      await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ parent_proposal_id: first.data.id }));

      const chain = await mockProposalsRepository.getProposalsByEvent("event_1");
      expect(chain.map((p) => p.version)).toEqual([2, 1]);
    });

    it("returns null when no proposal exists for the Event", async () => {
      expect(await mockProposalsRepository.getLatestProposalForEvent("event_missing")).toBeNull();
    });

    it("returns the highest-version proposal as latest", async () => {
      const first = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
      if (!first.success) throw new Error("setup failed");
      const second = await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ parent_proposal_id: first.data.id }));
      if (!second.success) throw new Error("setup failed");

      const latest = await mockProposalsRepository.getLatestProposalForEvent("event_1");
      expect(latest?.id).toBe(second.data.id);
    });

    it("never leaks another Event's proposals", async () => {
      await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ event_id: "event_other" }));
      expect(await mockProposalsRepository.getProposalsByEvent("event_1")).toEqual([]);
    });
  });

  describe("getRecentProposals", () => {
    it("returns only this Workspace's proposals, newest-generated first", async () => {
      await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ event_id: "event_1", generated_at: "2026-07-25T00:00:00.000Z" }));
      await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ event_id: "event_2", generated_at: "2026-07-26T00:00:00.000Z" }));
      await mockProposalsRepository.createProposalDraft("ws_2", makeInput({ event_id: "event_3", generated_at: "2026-07-27T00:00:00.000Z" }));

      const recent = await mockProposalsRepository.getRecentProposals("ws_1", 10);
      expect(recent.map((p) => p.event_id)).toEqual(["event_2", "event_1"]);
    });

    it("caps the result at `limit`", async () => {
      for (let index = 0; index < 5; index += 1) {
        await mockProposalsRepository.createProposalDraft("ws_1", makeInput({ event_id: `event_${index}` }));
      }
      const recent = await mockProposalsRepository.getRecentProposals("ws_1", 3);
      expect(recent).toHaveLength(3);
    });

    it("returns an empty array for a Workspace with no proposals yet", async () => {
      expect(await mockProposalsRepository.getRecentProposals("ws_empty", 10)).toEqual([]);
    });
  });
});
