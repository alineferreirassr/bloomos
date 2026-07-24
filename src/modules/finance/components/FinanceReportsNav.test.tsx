import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceReportsNav } from "@/modules/finance/components/FinanceReportsNav";

let pathname = "/finance/reports";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("FinanceReportsNav", () => {
  it("renders exactly the five implemented report destinations, no deferred-report links", () => {
    pathname = "/finance/reports";
    render(<FinanceReportsNav />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/finance/reports");
    expect(screen.getByRole("link", { name: "General Ledger" })).toHaveAttribute("href", "/finance/reports/general-ledger");
    expect(screen.getByRole("link", { name: "Trial Balance" })).toHaveAttribute("href", "/finance/reports/trial-balance");
    expect(screen.getByRole("link", { name: "Profit & Loss" })).toHaveAttribute("href", "/finance/reports/profit-and-loss");
    expect(screen.getByRole("link", { name: "Balance Sheet" })).toHaveAttribute("href", "/finance/reports/balance-sheet");
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.queryByRole("link", { name: /cash flow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /aging/i })).not.toBeInTheDocument();
  });

  it("marks Overview active only on the exact /finance/reports path", () => {
    pathname = "/finance/reports";
    render(<FinanceReportsNav />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "General Ledger" })).not.toHaveAttribute("aria-current");
  });

  it("marks a specific report active by prefix match, not Overview", () => {
    pathname = "/finance/reports/balance-sheet";
    render(<FinanceReportsNav />);
    expect(screen.getByRole("link", { name: "Balance Sheet" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("labels the nav landmark for assistive technology", () => {
    pathname = "/finance/reports";
    render(<FinanceReportsNav />);
    expect(screen.getByRole("navigation", { name: "Finance Reports" })).toBeInTheDocument();
  });
});
