import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/modules/analytics/generateAnalyticsExecutiveSummary", () => ({
  generateAnalyticsExecutiveSummary: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { AnalyticsExecutiveSummaryCard } from "@/modules/analytics/components/AnalyticsExecutiveSummaryCard";
import { generateAnalyticsExecutiveSummary } from "@/modules/analytics/generateAnalyticsExecutiveSummary";

describe("AnalyticsExecutiveSummaryCard", () => {
  it("never auto-generates on mount — an explicit click is required", async () => {
    render(<AnalyticsExecutiveSummaryCard windowKey="30d" />);
    expect(screen.getByText(/Ask Bloom AI to narrate/)).toBeInTheDocument();
    expect(generateAnalyticsExecutiveSummary).not.toHaveBeenCalled();
  });

  it("renders the narrative sections returned by the Skill after Generate Summary is clicked", async () => {
    vi.mocked(generateAnalyticsExecutiveSummary).mockResolvedValue({
      success: true,
      data: { executiveSummary: "Momentum is positive.", operationalRisks: ["Collected is down 10%."], performanceHighlights: ["Revenue is up 20%."], recommendations: ["Review overdue invoices."] },
    });

    render(<AnalyticsExecutiveSummaryCard windowKey="30d" />);
    fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));

    await waitFor(() => expect(screen.getByText("Momentum is positive.")).toBeInTheDocument());
    expect(screen.getByText("Revenue is up 20%.")).toBeInTheDocument();
    expect(screen.getByText("Collected is down 10%.")).toBeInTheDocument();
    expect(screen.getByText("Review overdue invoices.")).toBeInTheDocument();
    expect(generateAnalyticsExecutiveSummary).toHaveBeenCalledWith("30d");
  });

  it("shows the repository's own error message rather than a generic failure on error", async () => {
    vi.mocked(generateAnalyticsExecutiveSummary).mockResolvedValue({ success: false, error: "The Executive Summary isn't available. You may not have access to it." });
    render(<AnalyticsExecutiveSummaryCard windowKey="30d" />);
    fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("You may not have access to it."));
  });

  it("offers Regenerate, not Generate Summary, once a summary already exists", async () => {
    vi.mocked(generateAnalyticsExecutiveSummary).mockResolvedValue({ success: true, data: { executiveSummary: "ok", operationalRisks: [], performanceHighlights: [], recommendations: [] } });
    render(<AnalyticsExecutiveSummaryCard windowKey="30d" />);
    fireEvent.click(screen.getByRole("button", { name: /generate summary/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument());
  });
});
