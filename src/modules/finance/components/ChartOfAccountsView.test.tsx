import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartOfAccountsView } from "@/modules/finance/components/ChartOfAccountsView";
import { makeChartOfAccount } from "@/modules/finance/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.view", "finance.accounting.view", "finance.reports.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderView() {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <ChartOfAccountsView />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/accounts",
}));

vi.mock("@/lib/data", () => ({
  getChartOfAccounts: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ChartOfAccountsView", () => {
  it("renders accounts with their type and normal balance", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([
      makeChartOfAccount({ id: "a1", account_number: 1000, name: "Cash", account_type: "asset" }),
      makeChartOfAccount({ id: "a2", account_number: 4000, name: "Service Revenue", account_type: "revenue", normal_balance: "credit" }),
    ]);

    renderView();

    expect(await screen.findByText("Cash")).toBeInTheDocument();
    expect(screen.getAllByText("Service Revenue").length).toBeGreaterThan(0);
  });

  it("filters client-side by search text", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([
      makeChartOfAccount({ id: "a1", account_number: 1000, name: "Cash" }),
      makeChartOfAccount({ id: "a2", account_number: 4000, name: "Service Revenue" }),
    ]);

    renderView();
    await screen.findAllByText("Cash");

    await user.type(screen.getByLabelText(/search accounts/i), "revenue");

    await waitFor(() => expect(screen.queryByText("Cash")).not.toBeInTheDocument());
    expect(screen.getAllByText("Service Revenue").length).toBeGreaterThan(0);
  });

  it("re-fetches with includeArchived when the checkbox is checked", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);

    renderView();
    await waitFor(() => expect(dataLayer.getChartOfAccounts).toHaveBeenCalledWith({ includeArchived: false }));

    await user.click(screen.getByRole("checkbox", { name: /include inactive/i }));

    await waitFor(() => expect(dataLayer.getChartOfAccounts).toHaveBeenLastCalledWith({ includeArchived: true }));
  });

  it("shows an inactive badge for archived accounts", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([
      makeChartOfAccount({ id: "a1", name: "Old Account", archived_at: "2026-01-01T00:00:00.000Z" }),
    ]);

    renderView();

    expect(await screen.findAllByText("Inactive")).not.toHaveLength(0);
  });

  it("shows an empty state when no accounts match", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);

    renderView();

    expect(await screen.findByText(/no accounts yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockRejectedValue(new Error("boom"));

    renderView();

    expect(await screen.findByText(/could not load the chart of accounts/i)).toBeInTheDocument();
  });
});
