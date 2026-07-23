import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartOfAccountsView } from "@/modules/finance/components/ChartOfAccountsView";
import { makeChartOfAccount } from "@/modules/finance/testUtils";

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

    render(<ChartOfAccountsView />);

    expect(await screen.findByText("Cash")).toBeInTheDocument();
    expect(screen.getAllByText("Service Revenue").length).toBeGreaterThan(0);
  });

  it("filters client-side by search text", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([
      makeChartOfAccount({ id: "a1", account_number: 1000, name: "Cash" }),
      makeChartOfAccount({ id: "a2", account_number: 4000, name: "Service Revenue" }),
    ]);

    render(<ChartOfAccountsView />);
    await screen.findAllByText("Cash");

    await user.type(screen.getByLabelText(/search accounts/i), "revenue");

    await waitFor(() => expect(screen.queryByText("Cash")).not.toBeInTheDocument());
    expect(screen.getAllByText("Service Revenue").length).toBeGreaterThan(0);
  });

  it("re-fetches with includeArchived when the checkbox is checked", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);

    render(<ChartOfAccountsView />);
    await waitFor(() => expect(dataLayer.getChartOfAccounts).toHaveBeenCalledWith({ includeArchived: false }));

    await user.click(screen.getByRole("checkbox", { name: /include inactive/i }));

    await waitFor(() => expect(dataLayer.getChartOfAccounts).toHaveBeenLastCalledWith({ includeArchived: true }));
  });

  it("shows an inactive badge for archived accounts", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([
      makeChartOfAccount({ id: "a1", name: "Old Account", archived_at: "2026-01-01T00:00:00.000Z" }),
    ]);

    render(<ChartOfAccountsView />);

    expect(await screen.findAllByText("Inactive")).not.toHaveLength(0);
  });

  it("shows an empty state when no accounts match", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockResolvedValue([]);

    render(<ChartOfAccountsView />);

    expect(await screen.findByText(/no accounts yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(dataLayer.getChartOfAccounts).mockRejectedValue(new Error("boom"));

    render(<ChartOfAccountsView />);

    expect(await screen.findByText(/could not load the chart of accounts/i)).toBeInTheDocument();
  });
});
