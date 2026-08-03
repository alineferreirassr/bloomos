import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProposalDashboardView } from "@/modules/proposalPlatform/components/ProposalDashboardView";
import type { ProposalSummary, ProposalAnalyticsSnapshot } from "@/types/proposalPlatform";

vi.mock("@/modules/proposalPlatform/proposalPlatformActions", () => ({
  listProposalSummariesAction: vi.fn(),
  getProposalAnalyticsAction: vi.fn(),
}));

import { listProposalSummariesAction, getProposalAnalyticsAction } from "@/modules/proposalPlatform/proposalPlatformActions";

function makeSummary(overrides: Partial<ProposalSummary> = {}): ProposalSummary {
  return {
    proposalId: "proposal_1",
    eventId: "event_1",
    clientId: "client_1",
    documentStatus: "draft",
    proposalStatus: "draft",
    currentVersionNumber: 1,
    templateKey: "picnic_proposal",
    grandTotal_minor: 65000,
    currency: "USD",
    overallHealthScore: 80,
    readinessState: "needs_review",
    sentAt: null,
    viewedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function makeAnalytics(overrides: Partial<ProposalAnalyticsSnapshot> = {}): ProposalAnalyticsSnapshot {
  return {
    totalProposals: 1,
    draftCount: 1,
    publishedCount: 0,
    sentCount: 0,
    viewedCount: 0,
    acceptedCount: 0,
    declinedCount: 0,
    archivedCount: 0,
    acceptanceRate: 0,
    conversionRate: 0,
    averageProposalValue_minor: 65000,
    averageTimeToAcceptHours: null,
    averageRevisionCount: 0,
    templateUsage: { picnic_proposal: 1 },
    packageUsage: {},
    addonUsage: {},
    averageDiscountPercent: 0,
    averageDepositPercent: 30,
    evaluatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("ProposalDashboardView", () => {
  it("renders KPIs and the proposal list once loaded", async () => {
    vi.mocked(listProposalSummariesAction).mockResolvedValue({ success: true, data: [makeSummary()] });
    vi.mocked(getProposalAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics() });
    render(<ProposalDashboardView />);
    await waitFor(() => expect(screen.getAllByText("Picnic Proposal").length).toBeGreaterThan(0));
    expect(screen.getByText("Drafts")).toBeInTheDocument();
  });

  it("shows an accessible empty state when the action fails", async () => {
    vi.mocked(listProposalSummariesAction).mockResolvedValue({ success: false, error: "The Proposal Platform isn't available." });
    vi.mocked(getProposalAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics() });
    render(<ProposalDashboardView />);
    await waitFor(() => expect(screen.getByText("The Proposal Platform isn't available")).toBeInTheDocument());
  });

  it("shows a friendly empty state when no proposals match the filter", async () => {
    vi.mocked(listProposalSummariesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getProposalAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics({ totalProposals: 0, draftCount: 0 }) });
    render(<ProposalDashboardView />);
    await waitFor(() => expect(screen.getByText("No proposals match this filter")).toBeInTheDocument());
  });

  it("displays top template usage", async () => {
    vi.mocked(listProposalSummariesAction).mockResolvedValue({ success: true, data: [makeSummary()] });
    vi.mocked(getProposalAnalyticsAction).mockResolvedValue({ success: true, data: makeAnalytics() });
    render(<ProposalDashboardView />);
    await waitFor(() => expect(screen.getByText("Top Templates")).toBeInTheDocument());
  });
});
