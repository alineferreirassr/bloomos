import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceLedgerNav } from "@/modules/finance/components/FinanceLedgerNav";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

let pathname = "/finance";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.view", "finance.accounting.view", "finance.reports.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderNav(snapshot: MemberSessionSnapshot = fullPermissionSnapshot) {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <FinanceLedgerNav />
    </MemberSessionProvider>,
  );
}

describe("FinanceLedgerNav", () => {
  it("renders all five tabs including Reports, with no Stripe link", () => {
    pathname = "/finance";
    renderNav();
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chart of Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Journal Entries" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounting Periods" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/finance/reports");
    expect(screen.queryByRole("link", { name: /stripe/i })).not.toBeInTheDocument();
  });

  it("marks Overview as the active tab only on the exact /finance path", () => {
    pathname = "/finance";
    renderNav();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Chart of Accounts" })).not.toHaveAttribute("aria-current");
  });

  it("marks Journal Entries active on its detail route via prefix match", () => {
    pathname = "/finance/journal/entry_123";
    renderNav();
    expect(screen.getByRole("link", { name: "Journal Entries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("marks Reports active on any report sub-route via prefix match", () => {
    pathname = "/finance/reports/general-ledger";
    renderNav();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("Phase 06B — omits Chart of Accounts/Journal Entries/Accounting Periods when the caller lacks finance.accounting.view", () => {
    pathname = "/finance";
    renderNav({ ...fullPermissionSnapshot, permissions: ["finance.view"] });
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Chart of Accounts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Journal Entries" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Accounting Periods" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reports" })).not.toBeInTheDocument();
  });
});
