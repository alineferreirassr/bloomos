import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProposalDetailView } from "@/modules/proposalPlatform/components/ProposalDetailView";
import type { ProposalDetail } from "@/types/proposalPlatform";
import type { ProposalDraft } from "@/types/proposal";

vi.mock("@/modules/proposalPlatform/proposalPlatformActions", () => ({
  evaluateProposalAction: vi.fn(),
  listProposalTemplatesAction: vi.fn(),
  listProposalPackagesAction: vi.fn(),
  listProposalAddonsAction: vi.fn(),
  createProposalVersionAction: vi.fn(),
  publishProposalVersionAction: vi.fn(),
  archiveProposalAction: vi.fn(),
  restoreProposalVersionAction: vi.fn(),
  compareProposalVersionsAction: vi.fn(),
  sendProposalAction: vi.fn(),
}));

vi.mock("@/modules/communication/comments/components/CommentsPanel", () => ({
  CommentsPanel: () => <div data-testid="comments-panel" />,
}));

import { evaluateProposalAction, listProposalTemplatesAction, listProposalPackagesAction, listProposalAddonsAction } from "@/modules/proposalPlatform/proposalPlatformActions";

function makeProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "proposal_1",
    workspace_id: "ws_1",
    event_id: "event_1",
    client_id: "client_1",
    status: "draft",
    version: 1,
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
    generated_at: now,
    reviewed_by: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ProposalDetail> = {}): ProposalDetail {
  return {
    proposal: makeProposal(),
    builderState: null,
    currentVersion: null,
    health: { categories: [], overallScore: 0, evaluatedAt: "2026-01-01T00:00:00.000Z" },
    readiness: { state: "missing_sections", reasons: ["No proposal document has been built yet."], canSend: false },
    ...overrides,
  };
}

describe("ProposalDetailView", () => {
  it("renders the proposal's readiness state once loaded", async () => {
    vi.mocked(evaluateProposalAction).mockResolvedValue({ success: true, data: makeDetail() });
    vi.mocked(listProposalTemplatesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalPackagesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalAddonsAction).mockResolvedValue({ success: true, data: [] });
    render(<ProposalDetailView proposalId="proposal_1" />);
    await waitFor(() => expect(screen.getByText("Missing Sections")).toBeInTheDocument());
  });

  it("shows an accessible empty state when the proposal can't be found", async () => {
    vi.mocked(evaluateProposalAction).mockResolvedValue({ success: false, error: "This proposal could not be found." });
    vi.mocked(listProposalTemplatesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalPackagesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalAddonsAction).mockResolvedValue({ success: true, data: [] });
    render(<ProposalDetailView proposalId="nonexistent" />);
    await waitFor(() => expect(screen.getByText("This proposal isn't available")).toBeInTheDocument());
  });

  it("disables the Send button when the proposal isn't ready", async () => {
    vi.mocked(evaluateProposalAction).mockResolvedValue({ success: true, data: makeDetail() });
    vi.mocked(listProposalTemplatesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalPackagesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalAddonsAction).mockResolvedValue({ success: true, data: [] });
    render(<ProposalDetailView proposalId="proposal_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Send to Client" })).toBeDisabled());
  });

  it("renders the comments panel", async () => {
    vi.mocked(evaluateProposalAction).mockResolvedValue({ success: true, data: makeDetail() });
    vi.mocked(listProposalTemplatesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalPackagesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listProposalAddonsAction).mockResolvedValue({ success: true, data: [] });
    render(<ProposalDetailView proposalId="proposal_1" />);
    await waitFor(() => expect(screen.getByTestId("comments-panel")).toBeInTheDocument());
  });
});
