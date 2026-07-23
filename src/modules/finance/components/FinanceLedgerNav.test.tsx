import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceLedgerNav } from "@/modules/finance/components/FinanceLedgerNav";

let pathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("FinanceLedgerNav", () => {
  it("renders all four tabs with no Reports or Stripe links", () => {
    pathname = "/finance";
    render(<FinanceLedgerNav />);
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chart of Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Journal Entries" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounting Periods" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /report/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /stripe/i })).not.toBeInTheDocument();
  });

  it("marks Overview as the active tab only on the exact /finance path", () => {
    pathname = "/finance";
    render(<FinanceLedgerNav />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Chart of Accounts" })).not.toHaveAttribute("aria-current");
  });

  it("marks Journal Entries active on its detail route via prefix match", () => {
    pathname = "/finance/journal/entry_123";
    render(<FinanceLedgerNav />);
    expect(screen.getByRole("link", { name: "Journal Entries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });
});
