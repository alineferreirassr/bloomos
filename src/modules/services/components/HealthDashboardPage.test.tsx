import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/services/hooks/useServiceHealth", () => ({ useServiceHealth: vi.fn() }));

import { HealthDashboardPage } from "@/modules/services/components/HealthDashboardPage";
import { useServiceHealth } from "@/modules/services/hooks/useServiceHealth";
import type { ServiceHealthSummary } from "@/lib/queries/services/types";

function health(overrides: Partial<ServiceHealthSummary> = {}): ServiceHealthSummary {
  return { percent: 100, missing: [], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HealthDashboardPage", () => {
  it("shows a loading state while pending", () => {
    vi.mocked(useServiceHealth).mockReturnValue({ status: "pending", data: undefined, error: null, refetch: vi.fn() } as never);
    const { container } = render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows an error state with retry wired to refetch", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    vi.mocked(useServiceHealth).mockReturnValue({ status: "error", data: undefined, error: new Error("boom"), refetch } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    expect(screen.getByText(/couldn't load Service Health/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty-issues state and a 100% score when nothing is missing", () => {
    vi.mocked(useServiceHealth).mockReturnValue({ status: "success", data: health(), refetch: vi.fn() } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    expect(screen.getByText("No issues")).toBeInTheDocument();
    expect(screen.getByText("No health blockers")).toBeInTheDocument();
  });

  it("renders all 9 category rows in the breakdown, every one Complete when nothing is missing", () => {
    vi.mocked(useServiceHealth).mockReturnValue({ status: "success", data: health(), refetch: vi.fn() } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    // 9 category-card "Complete" badges plus the Breakdown card's own "Complete" <dt> label.
    expect(screen.getAllByText("Complete").length).toBe(10);
    expect(screen.getByText("9 / 9")).toBeInTheDocument();
  });

  it("splits blocking (base price) from warnings (template categories) in the Breakdown and Issues sections", () => {
    vi.mocked(useServiceHealth).mockReturnValue({
      status: "success",
      data: health({
        percent: 40,
        missing: [
          { label: "Set a base price", jumpTo: { kind: "draftVersionForm" } },
          { label: "Budget", jumpTo: { kind: "templateCategory", category: "budgetLines" } },
        ],
      }),
      refetch: vi.fn(),
    } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Blocking" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Warnings" })).toBeInTheDocument();
    // Breakdown numbers: 1 blocking, 1 warning, 7 complete of 9.
    expect(screen.getByText("Blocking", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Warnings", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("7 / 9")).toBeInTheDocument();
  });

  it("navigates to the templates tab with the exact category when a template-category issue is reviewed", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    vi.mocked(useServiceHealth).mockReturnValue({
      status: "success",
      data: health({ percent: 85, missing: [{ label: "Timeline", jumpTo: { kind: "templateCategory", category: "timelineItems" } }] }),
      refetch: vi.fn(),
    } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={onNavigate} />);
    await user.click(screen.getByRole("button", { name: "Review: Timeline" }));
    expect(onNavigate).toHaveBeenCalledWith({ tab: "templates", category: "timelineItems" });
  });

  it("navigates to the overview tab (no category) when the base-price issue is reviewed", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    vi.mocked(useServiceHealth).mockReturnValue({
      status: "success",
      data: health({ percent: 80, missing: [{ label: "Set a base price", jumpTo: { kind: "draftVersionForm" } }] }),
      refetch: vi.fn(),
    } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={onNavigate} />);
    await user.click(screen.getByRole("button", { name: "Review: Base price" }));
    expect(onNavigate).toHaveBeenCalledWith({ tab: "overview" });
  });

  it("renders the sidebar's quick navigation with one entry per category, each navigating on click", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    vi.mocked(useServiceHealth).mockReturnValue({ status: "success", data: health(), refetch: vi.fn() } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={onNavigate} />);
    const quickNavHeading = screen.getByText("Quick navigation");
    const quickNavCard = quickNavHeading.parentElement as HTMLElement;
    const budgetLink = within(quickNavCard).getByText("Budget").closest("button");
    expect(budgetLink).toBeInTheDocument();
    await user.click(budgetLink as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith({ tab: "templates", category: "budgetLines" });
  });

  it("never renders a form control or calls a mutation — the dashboard is entirely read-only", () => {
    vi.mocked(useServiceHealth).mockReturnValue({
      status: "success",
      data: health({ percent: 50, missing: [{ label: "Checklist", jumpTo: { kind: "templateCategory", category: "checklistItems" } }] }),
      refetch: vi.fn(),
    } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("exposes every score as a real progressbar with a numeric value, for assistive tech", () => {
    vi.mocked(useServiceHealth).mockReturnValue({ status: "success", data: health({ percent: 63 }), refetch: vi.fn() } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.some((bar) => bar.getAttribute("aria-valuenow") === "63")).toBe(true);
  });

  it("gives every 'Review'/'Fix now' action a unique accessible name so multiple identical actions on one page are distinguishable", () => {
    vi.mocked(useServiceHealth).mockReturnValue({
      status: "success",
      data: health({ percent: 20, missing: [{ label: "Checklist", jumpTo: { kind: "templateCategory", category: "checklistItems" } }] }),
      refetch: vi.fn(),
    } as never);
    render(<HealthDashboardPage serviceId="s1" onNavigate={vi.fn()} />);
    const namedButtons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(new Set(namedButtons).size).toBe(namedButtons.length);
  });
});
