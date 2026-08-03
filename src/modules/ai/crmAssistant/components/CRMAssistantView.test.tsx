import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CRMAssistantView } from "@/modules/ai/crmAssistant/components/CRMAssistantView";
import { getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
import { CRM_ASSISTANT_SKILL_ID } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";
import type { GenerateCRMAssistantBriefResult } from "@/modules/ai/crmAssistant/types";

vi.mock("@/modules/ai/crmAssistant/generateCRMAssistantBrief", () => ({
  generateCRMAssistantBrief: vi.fn(),
}));

import { generateCRMAssistantBrief } from "@/modules/ai/crmAssistant/generateCRMAssistantBrief";

const emptyContext = {
  generatedAt: "2026-07-26T00:00:00.000Z",
  totalClientCount: 0,
  totalLeadCount: 0,
  priorityClients: [],
  inactiveClients: [],
  clientsAtRisk: [],
  activeLeads: [],
  upcomingEvents: [],
  pastEvents: [],
  unsignedContracts: [],
  outstandingInvoices: [],
  outstandingBalanceMinor: 0,
  outstandingCurrency: "USD",
  proposalHistory: [],
  recentDailyBriefs: [],
  recentActivity: [],
  communicationSummary: { totalLoggedTouchpoints: 0, mostRecentTouchpointAt: null },
  recentMemories: [],
  unavailableCategories: [],
};

function baseBrief() {
  return {
    executiveSummary: "Relationships are healthy overall.",
    relationshipHealth: { summary: "No urgent issues.", totalClients: 0, totalLeads: 0, priorityClientCount: 0, inactiveClientCount: 0, atRiskClientCount: 0 },
    priorityClients: [],
    inactiveClients: [],
    clientsAtRisk: [],
    unsignedContracts: [],
    outstandingPayments: [],
    outstandingBalanceMinor: 0,
    outstandingCurrency: "USD",
    upcomingOpportunities: [],
    suggestedFollowUps: [],
    recommendedActions: [],
    confidence: 100,
    missingInformation: [],
    relevantMemories: [],
  };
}

function makeResult(overrides: { brief?: Record<string, unknown> } = {}): GenerateCRMAssistantBriefResult {
  return {
    success: true,
    data: {
      context: emptyContext,
      brief: { ...baseBrief(), ...overrides.brief },
      mock: true,
      model: "bloomos-crm-mock-v1",
      provider: "mock",
      promptVersion: "crm-assistant-v1",
      contextVersion: "crm-assistant-context-v1",
      generatedAt: "2026-07-26T00:00:00.000Z",
    },
  } as GenerateCRMAssistantBriefResult;
}

afterEach(() => {
  vi.clearAllMocks();
  resetSkillRunnerRegistry();
});

describe("CRMAssistantView", () => {
  it("shows an idle prompt before any generation", () => {
    render(<CRMAssistantView />);
    expect(screen.getByText(/no crm report has been generated yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate crm report/i })).toBeInTheDocument();
  });

  it("generates a report on click and renders the Executive Summary", async () => {
    const user = userEvent.setup();
    vi.mocked(generateCRMAssistantBrief).mockResolvedValue(makeResult());
    render(<CRMAssistantView />);

    await user.click(screen.getByRole("button", { name: /generate crm report/i }));
    await waitFor(() => expect(screen.getByText("Relationships are healthy overall.")).toBeInTheDocument());
    expect(screen.getByText("No urgent issues.")).toBeInTheDocument();
  });

  it("shows a safe error with retry when generation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(generateCRMAssistantBrief).mockResolvedValue({ success: false, error: "The CRM Assistant isn't available." });
    render(<CRMAssistantView />);

    await user.click(screen.getByRole("button", { name: /generate crm report/i }));
    await waitFor(() => expect(screen.getByText("The CRM Assistant isn't available.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders Client Risk with a real Client link and explanation", async () => {
    const user = userEvent.setup();
    vi.mocked(generateCRMAssistantBrief).mockResolvedValue(
      makeResult({
        brief: {
          clientsAtRisk: [{ client: { clientId: "c1", name: "Jane Doe", reasons: ["Unsigned contract C-1"] }, explanation: "Contract still unsigned." }],
        },
      }),
    );
    render(<CRMAssistantView />);
    await user.click(screen.getByRole("button", { name: /generate crm report/i }));

    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.getByText("Contract still unsigned.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jane Doe" })).toHaveAttribute("href", "/clients/c1");
  });

  it("renders Payment Status with the formatted outstanding balance", async () => {
    const user = userEvent.setup();
    vi.mocked(generateCRMAssistantBrief).mockResolvedValue(
      makeResult({
        brief: {
          outstandingBalanceMinor: 12345,
          outstandingCurrency: "USD",
          outstandingPayments: [{ invoiceId: "inv1", invoiceNumber: "INV-9", clientId: "c1", eventId: null, status: "overdue", balanceMinor: 12345, currency: "USD", dueDate: null }],
        },
      }),
    );
    render(<CRMAssistantView />);
    await user.click(screen.getByRole("button", { name: /generate crm report/i }));

    await waitFor(() => expect(screen.getByText(/\$123\.45 outstanding across 1 invoice/)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Invoice INV-9" })).toHaveAttribute("href", "/finance/invoices/inv1");
  });

  it("registers a Skill runner for crm-assistant on mount, unregisters on unmount", async () => {
    vi.mocked(generateCRMAssistantBrief).mockResolvedValue(makeResult());
    const { unmount } = render(<CRMAssistantView />);

    expect(getSkillRunner(CRM_ASSISTANT_SKILL_ID)).toBeDefined();
    await getSkillRunner(CRM_ASSISTANT_SKILL_ID)?.();
    await waitFor(() => expect(generateCRMAssistantBrief).toHaveBeenCalled());

    unmount();
    expect(getSkillRunner(CRM_ASSISTANT_SKILL_ID)).toBeUndefined();
  });

  it("copies the report as plain text on Copy", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    vi.mocked(generateCRMAssistantBrief).mockResolvedValue(makeResult());
    render(<CRMAssistantView />);

    await user.click(screen.getByRole("button", { name: /generate crm report/i }));
    await waitFor(() => expect(screen.getByText("Relationships are healthy overall.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /copy crm report as text/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("CRM ASSISTANT REPORT"));
    await waitFor(() => expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument());
  });
});
