import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountingPeriodsView } from "@/modules/finance/components/AccountingPeriodsView";
import { makeAccountingPeriod } from "@/modules/finance/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.view", "finance.create", "finance.update", "finance.refund"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderView(permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <AccountingPeriodsView />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/periods",
}));

vi.mock("@/lib/data", () => ({
  getAccountingPeriods: vi.fn(),
  createAccountingPeriod: vi.fn(),
  closeAccountingPeriod: vi.fn(),
  lockAccountingPeriod: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("AccountingPeriodsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders periods with their status", async () => {
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([
      makeAccountingPeriod({ id: "p1", status: "open", period_start: "2026-01-01", period_end: "2026-01-31" }),
    ]);

    renderView();

    expect((await screen.findAllByText("Open")).length).toBeGreaterThan(0);
  });

  it("re-fetches when the status filter changes", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([]);

    renderView();
    await waitFor(() => expect(dataLayer.getAccountingPeriods).toHaveBeenCalledWith({ status: "all" }));

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "open");

    await waitFor(() => expect(dataLayer.getAccountingPeriods).toHaveBeenLastCalledWith({ status: "open" }));
  });

  it("shows Close only for an open period and Lock only for a closed period", async () => {
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([
      makeAccountingPeriod({ id: "open_period", status: "open" }),
      makeAccountingPeriod({ id: "closed_period", status: "closed" }),
      makeAccountingPeriod({ id: "locked_period", status: "locked" }),
    ]);

    renderView();
    await screen.findAllByText("Open");

    // One open period and one closed period, each rendered once in the
    // desktop table and once in the mobile card list — 2 occurrences apiece.
    expect(screen.getAllByRole("button", { name: /^close$/i }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: /^lock$/i }).length).toBe(2);
  });

  it("hides Create/Close/Lock actions without finance permissions", async () => {
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([makeAccountingPeriod({ id: "p1", status: "open" })]);

    renderView(["finance.view"]);
    await screen.findAllByText("Open");

    expect(screen.queryByRole("button", { name: /create period/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^close$/i })).not.toBeInTheDocument();
  });

  it("validates start <= end and calls createAccountingPeriod on success", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([]);
    vi.mocked(dataLayer.createAccountingPeriod).mockResolvedValue({
      success: true,
      data: makeAccountingPeriod({ id: "new_period", period_start: "2026-02-01", period_end: "2026-02-28" }),
    });

    renderView();
    await screen.findByText(/no accounting periods yet/i);

    await user.click(screen.getAllByRole("button", { name: /create period/i })[0]);
    const dialog = screen.getByRole("dialog", { name: /create accounting period/i });
    await user.type(within(dialog).getByLabelText(/start date/i), "2026-02-01");
    await user.type(within(dialog).getByLabelText(/end date/i), "2026-02-28");
    await user.click(within(dialog).getByRole("button", { name: /^create period$/i }));

    await waitFor(() =>
      expect(dataLayer.createAccountingPeriod).toHaveBeenCalledWith({
        period_start: "2026-02-01",
        period_end: "2026-02-28",
      }),
    );
  });

  it("rejects an end date that is not after the start date before calling the Repository", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([]);

    renderView();
    await screen.findByText(/no accounting periods yet/i);

    await user.click(screen.getAllByRole("button", { name: /create period/i })[0]);
    const dialog = screen.getByRole("dialog", { name: /create accounting period/i });
    await user.type(within(dialog).getByLabelText(/start date/i), "2026-02-28");
    await user.type(within(dialog).getByLabelText(/end date/i), "2026-02-01");
    await user.click(within(dialog).getByRole("button", { name: /^create period$/i }));

    expect(await within(dialog).findByText(/end date must be after start date/i)).toBeInTheDocument();
    expect(dataLayer.createAccountingPeriod).not.toHaveBeenCalled();
  });

  it("surfaces a translated overlap error from create without closing the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([]);
    vi.mocked(dataLayer.createAccountingPeriod).mockResolvedValue({
      success: false,
      error: "This period overlaps an existing accounting period.",
    });

    renderView();
    await screen.findByText(/no accounting periods yet/i);

    await user.click(screen.getAllByRole("button", { name: /create period/i })[0]);
    const dialog = screen.getByRole("dialog", { name: /create accounting period/i });
    await user.type(within(dialog).getByLabelText(/start date/i), "2026-02-01");
    await user.type(within(dialog).getByLabelText(/end date/i), "2026-02-28");
    await user.click(within(dialog).getByRole("button", { name: /^create period$/i }));

    expect(await within(dialog).findByText(/overlaps an existing accounting period/i)).toBeInTheDocument();
  });

  it("closes an open period through a confirmation dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([makeAccountingPeriod({ id: "p1", status: "open" })]);
    vi.mocked(dataLayer.closeAccountingPeriod).mockResolvedValue({
      success: true,
      data: makeAccountingPeriod({ id: "p1", status: "closed" }),
    });

    renderView();
    await screen.findAllByText("Open");

    await user.click(screen.getAllByRole("button", { name: /^close$/i })[0]);
    const dialog = screen.getByRole("dialog", { name: /close accounting period/i });
    await user.click(within(dialog).getByRole("button", { name: /^close period$/i }));

    await waitFor(() => expect(dataLayer.closeAccountingPeriod).toHaveBeenCalledWith("p1"));
  });

  it("locks a closed period through a confirmation dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([makeAccountingPeriod({ id: "p1", status: "closed" })]);
    vi.mocked(dataLayer.lockAccountingPeriod).mockResolvedValue({
      success: true,
      data: makeAccountingPeriod({ id: "p1", status: "locked" }),
    });

    renderView();
    await screen.findAllByText("Closed");

    await user.click(screen.getAllByRole("button", { name: /^lock$/i })[0]);
    const dialog = screen.getByRole("dialog", { name: /lock accounting period/i });
    await user.click(within(dialog).getByRole("button", { name: /^lock period$/i }));

    await waitFor(() => expect(dataLayer.lockAccountingPeriod).toHaveBeenCalledWith("p1"));
  });

  it("shows an empty state when no periods exist", async () => {
    vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([]);

    renderView();

    expect(await screen.findByText(/no accounting periods yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(dataLayer.getAccountingPeriods).mockRejectedValue(new Error("boom"));

    renderView();

    expect(await screen.findByText(/could not load accounting periods/i)).toBeInTheDocument();
  });
});
