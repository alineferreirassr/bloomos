import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FinanceAssistantView } from "@/modules/ai/financeAssistant/components/FinanceAssistantView";
import { getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
import { FINANCE_ASSISTANT_SKILL_ID } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import type { GenerateFinanceAssistantBriefResult } from "@/modules/ai/financeAssistant/types";

vi.mock("@/modules/ai/financeAssistant/generateFinanceAssistantBrief", () => ({
  generateFinanceAssistantBrief: vi.fn(),
}));

import { generateFinanceAssistantBrief } from "@/modules/ai/financeAssistant/generateFinanceAssistantBrief";

const emptyContext = {
  generatedAt: "2026-07-26T00:00:00.000Z",
  currency: "USD",
  revenueThisMonthMinor: 0,
  collectedThisMonthMinor: 0,
  totalInvoicedAllTimeMinor: 0,
  totalCollectedAllTimeMinor: 0,
  outstandingReceivablesMinor: 0,
  overdueReceivablesMinor: 0,
  refundsThisMonthMinor: 0,
  depositsPendingMinor: 0,
  expensesThisMonthMinor: 0,
  netCashPositionMinor: 0,
  outstandingInvoices: [],
  paymentDelays: [],
  upcomingRevenue: [],
  refunds: [],
  contractValueTotalMinor: 0,
  contractValueSignedMinor: 0,
  contractValueUnsignedMinor: 0,
  unsignedContracts: [],
  proposalValues: [],
  upcomingEvents: [],
  financialRisks: [],
  recentDailyBriefs: [],
  recentActivity: [],
  crmRecommendations: [],
  recentMemories: [],
  unavailableCategories: [],
};

function baseBrief() {
  return {
    executiveSummary: "Revenue looks healthy this month.",
    revenueOverview: { summary: "Strong collection rate.", revenueThisMonthMinor: 0, collectedThisMonthMinor: 0, totalInvoicedAllTimeMinor: 0, totalCollectedAllTimeMinor: 0, currency: "USD" },
    outstandingPayments: [],
    upcomingRevenue: [],
    cashFlowSnapshot: { summary: "No cash flow concerns.", collectedMinor: 0, outstandingMinor: 0, upcomingMinor: 0, refundedMinor: 0, expensesMinor: 0, netCashPositionMinor: 0, currency: "USD" },
    financialRisks: [],
    paymentDelays: [],
    contractValue: { totalMinor: 0, signedMinor: 0, unsignedMinor: 0, currency: "USD" },
    revenueOpportunities: [],
    recommendations: [],
    confidence: 100,
    missingInformation: [],
    relevantMemories: [],
    crmRecommendations: [],
  };
}

function makeResult(overrides: { brief?: Record<string, unknown> } = {}): GenerateFinanceAssistantBriefResult {
  return {
    success: true,
    data: {
      context: emptyContext,
      brief: { ...baseBrief(), ...overrides.brief },
      mock: true,
      model: "bloomos-finance-mock-v1",
      provider: "mock",
      promptVersion: "finance-assistant-v1",
      contextVersion: "finance-assistant-context-v1",
      generatedAt: "2026-07-26T00:00:00.000Z",
    },
  } as GenerateFinanceAssistantBriefResult;
}

afterEach(() => {
  vi.clearAllMocks();
  resetSkillRunnerRegistry();
});

describe("FinanceAssistantView", () => {
  it("shows an idle prompt before any generation", () => {
    render(<FinanceAssistantView />);
    expect(screen.getByText(/no finance report has been generated yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate finance report/i })).toBeInTheDocument();
  });

  it("generates a report on click and renders the Executive Summary", async () => {
    const user = userEvent.setup();
    vi.mocked(generateFinanceAssistantBrief).mockResolvedValue(makeResult());
    render(<FinanceAssistantView />);

    await user.click(screen.getByRole("button", { name: /generate finance report/i }));
    await waitFor(() => expect(screen.getByText("Revenue looks healthy this month.")).toBeInTheDocument());
    expect(screen.getByText("Strong collection rate.")).toBeInTheDocument();
  });

  it("shows a safe error with retry when generation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(generateFinanceAssistantBrief).mockResolvedValue({ success: false, error: "The Finance Assistant isn't available." });
    render(<FinanceAssistantView />);

    await user.click(screen.getByRole("button", { name: /generate finance report/i }));
    await waitFor(() => expect(screen.getByText("The Finance Assistant isn't available.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders Financial Risks with a real explanation", async () => {
    const user = userEvent.setup();
    vi.mocked(generateFinanceAssistantBrief).mockResolvedValue(
      makeResult({
        brief: {
          financialRisks: [{ risk: { riskId: "invoice:i1", targetType: "invoice", targetId: "i1", label: "Invoice INV-1 severely overdue", reasons: ["25 days overdue"] }, explanation: "Client unresponsive to outreach." }],
        },
      }),
    );
    render(<FinanceAssistantView />);
    await user.click(screen.getByRole("button", { name: /generate finance report/i }));

    await waitFor(() => expect(screen.getByText("Invoice INV-1 severely overdue")).toBeInTheDocument());
    expect(screen.getByText("Client unresponsive to outreach.")).toBeInTheDocument();
  });

  it("renders Outstanding Payments with a real Invoice link and formatted amount", async () => {
    const user = userEvent.setup();
    vi.mocked(generateFinanceAssistantBrief).mockResolvedValue(
      makeResult({
        brief: {
          outstandingPayments: [{ invoiceId: "inv1", invoiceNumber: "INV-9", clientId: "c1", eventId: null, status: "sent", balanceMinor: 12345, totalMinor: 12345, currency: "USD", dueDate: null }],
        },
      }),
    );
    render(<FinanceAssistantView />);
    await user.click(screen.getByRole("button", { name: /generate finance report/i }));

    await waitFor(() => expect(screen.getByRole("link", { name: "Invoice INV-9" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Invoice INV-9" })).toHaveAttribute("href", "/finance/invoices/inv1");
    expect(screen.getByText("$123.45")).toBeInTheDocument();
  });

  it("renders Contract Value breakdown", async () => {
    const user = userEvent.setup();
    vi.mocked(generateFinanceAssistantBrief).mockResolvedValue(
      makeResult({ brief: { contractValue: { totalMinor: 500000, signedMinor: 200000, unsignedMinor: 300000, currency: "USD" } } }),
    );
    render(<FinanceAssistantView />);
    await user.click(screen.getByRole("button", { name: /generate finance report/i }));

    await waitFor(() => expect(screen.getByText("$5,000.00")).toBeInTheDocument());
    expect(screen.getByText("$2,000.00")).toBeInTheDocument();
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
  });

  it("registers a Skill runner for finance-assistant on mount, unregisters on unmount", async () => {
    vi.mocked(generateFinanceAssistantBrief).mockResolvedValue(makeResult());
    const { unmount } = render(<FinanceAssistantView />);

    expect(getSkillRunner(FINANCE_ASSISTANT_SKILL_ID)).toBeDefined();
    await getSkillRunner(FINANCE_ASSISTANT_SKILL_ID)?.();
    await waitFor(() => expect(generateFinanceAssistantBrief).toHaveBeenCalled());

    unmount();
    expect(getSkillRunner(FINANCE_ASSISTANT_SKILL_ID)).toBeUndefined();
  });

  it("copies the report as plain text on Copy", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    vi.mocked(generateFinanceAssistantBrief).mockResolvedValue(makeResult());
    render(<FinanceAssistantView />);

    await user.click(screen.getByRole("button", { name: /generate finance report/i }));
    await waitFor(() => expect(screen.getByText("Revenue looks healthy this month.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /copy finance report as text/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("FINANCE ASSISTANT REPORT"));
    await waitFor(() => expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument());
  });
});
