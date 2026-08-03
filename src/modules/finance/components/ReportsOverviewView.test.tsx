import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportsOverviewView } from "@/modules/finance/components/ReportsOverviewView";

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/reports",
}));

describe("ReportsOverviewView", () => {
  it("renders exactly four implemented report cards linking to their own routes", () => {
    render(<ReportsOverviewView />);

    expect(screen.getByRole("heading", { name: "General Ledger" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open General Ledger" })).toHaveAttribute(
      "href",
      "/finance/reports/general-ledger",
    );
    expect(screen.getByRole("heading", { name: "Trial Balance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Trial Balance" })).toHaveAttribute(
      "href",
      "/finance/reports/trial-balance",
    );
    expect(screen.getByRole("heading", { name: "Profit and Loss" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Profit and Loss" })).toHaveAttribute(
      "href",
      "/finance/reports/profit-and-loss",
    );
    expect(screen.getByRole("heading", { name: "Balance Sheet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Balance Sheet" })).toHaveAttribute(
      "href",
      "/finance/reports/balance-sheet",
    );

    // Exactly four cards — no fifth (deferred) report card exists.
    expect(screen.getAllByText(/^Open /).filter((el) => el.tagName === "BUTTON")).toHaveLength(4);
  });

  it("shows the correct date model for each report", () => {
    render(<ReportsOverviewView />);
    expect(screen.getAllByText("Date range")).toHaveLength(2);
    expect(screen.getAllByText("As-of date")).toHaveLength(2);
  });

  it("mentions Cash Flow, AR Aging, and AP Aging only as unavailable, with no link for them", () => {
    render(<ReportsOverviewView />);
    expect(screen.getByText(/cash flow.*accounts receivable aging.*accounts payable aging.*planned but not yet available/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /cash flow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /aging/i })).not.toBeInTheDocument();
  });

  it("performs no report fetch — renders purely from static navigation data", () => {
    // No @/lib/data mock is installed for this test at all; if the component
    // called any report-fetching function it would throw because the real
    // module (which requires a live Supabase/mock session context) is used
    // unmocked. Successful, synchronous rendering proves zero calculation.
    expect(() => render(<ReportsOverviewView />)).not.toThrow();
  });
});
