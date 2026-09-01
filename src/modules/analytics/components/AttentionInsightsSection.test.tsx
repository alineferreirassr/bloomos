import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/modules/analytics/insights/getExecutiveInsightsData", () => ({
  getExecutiveInsightsData: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockPush = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});

import { AttentionInsightsSection } from "@/modules/analytics/components/AttentionInsightsSection";
import { getExecutiveInsightsData } from "@/modules/analytics/insights/getExecutiveInsightsData";
import type { ExecutiveInsight } from "@/types/businessIntelligence";

function insight(overrides: Partial<ExecutiveInsight> = {}): ExecutiveInsight {
  return {
    id: "insight_1",
    category: "revenue",
    severity: "info",
    title: "Revenue is steady",
    detail: "Nothing unusual this month.",
    drillDown: null,
    ...overrides,
  };
}

describe("AttentionInsightsSection", () => {
  it("shows a loading skeleton before data resolves", () => {
    vi.mocked(getExecutiveInsightsData).mockReturnValue(new Promise(() => {}));
    render(<AttentionInsightsSection />);
    expect(screen.queryByText("Needs Your Attention")).not.toBeInTheDocument();
  });

  it("shows the repository's own error message with a working retry", async () => {
    vi.mocked(getExecutiveInsightsData).mockResolvedValueOnce({ success: false, error: "Insights aren't available right now." });
    render(<AttentionInsightsSection />);
    await waitFor(() => expect(screen.getByText("Insights aren't available right now.")).toBeInTheDocument());

    vi.mocked(getExecutiveInsightsData).mockResolvedValueOnce({ success: true, data: [] });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Nothing needs your attention right now.")).toBeInTheDocument());
  });

  it("shows the empty-state message when there are no insights", async () => {
    vi.mocked(getExecutiveInsightsData).mockResolvedValue({ success: true, data: [] });
    render(<AttentionInsightsSection />);
    await waitFor(() => expect(screen.getByText("Nothing needs your attention right now.")).toBeInTheDocument());
  });

  it("sorts by severity (critical first) and caps at the top 3", async () => {
    vi.mocked(getExecutiveInsightsData).mockResolvedValue({
      success: true,
      data: [
        insight({ id: "i_info", severity: "info", title: "Info item" }),
        insight({ id: "i_critical", severity: "critical", title: "Critical item" }),
        insight({ id: "i_warning", severity: "warning", title: "Warning item" }),
        insight({ id: "i_positive", severity: "positive", title: "Positive item" }),
      ],
    });
    render(<AttentionInsightsSection />);
    await waitFor(() => expect(screen.getByText("Critical item")).toBeInTheDocument());

    const titles = screen.getAllByText(/item$/).map((el) => el.textContent);
    expect(titles).toEqual(["Critical item", "Warning item", "Positive item"]);
    expect(screen.queryByText("Info item")).not.toBeInTheDocument();
  });

  it("navigates to the drill-down href when its button is clicked", async () => {
    vi.mocked(getExecutiveInsightsData).mockResolvedValue({
      success: true,
      data: [insight({ drillDown: { kind: "invoices", label: "Review", href: "/finance/invoices?status=overdue" } })],
    });
    render(<AttentionInsightsSection />);
    fireEvent.click(await screen.findByRole("button", { name: /review/i }));
    expect(mockPush).toHaveBeenCalledWith("/finance/invoices?status=overdue");
  });

  it("renders no drill-down control when an insight has none", async () => {
    vi.mocked(getExecutiveInsightsData).mockResolvedValue({ success: true, data: [insight({ drillDown: null })] });
    render(<AttentionInsightsSection />);
    await waitFor(() => expect(screen.getByText("Revenue is steady")).toBeInTheDocument());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
