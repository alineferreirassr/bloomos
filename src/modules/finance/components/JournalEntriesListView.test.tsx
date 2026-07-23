import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalEntriesListView } from "@/modules/finance/components/JournalEntriesListView";
import { makeJournalEntry, makeAccountingPeriod } from "@/modules/finance/testUtils";
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
      <JournalEntriesListView />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance/journal",
}));

vi.mock("@/lib/data", () => ({
  getJournalEntries: vi.fn(),
  getAccountingPeriods: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getAccountingPeriods).mockResolvedValue([makeAccountingPeriod({ id: "period_1" })]);
}

describe("JournalEntriesListView", () => {
  it("renders entries with memo, source type, and posting status", async () => {
    mockCommon();
    vi.mocked(dataLayer.getJournalEntries).mockResolvedValue([
      makeJournalEntry({ id: "entry_1", memo: "Deposit settlement", source_type: "payment_settlement", accounting_period_id: "period_1" }),
    ]);

    renderView();

    expect((await screen.findAllByText("Deposit settlement")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("payment_settlement").length).toBeGreaterThan(0);
  });

  it("shows a Reversal badge for an entry that reverses another", async () => {
    mockCommon();
    vi.mocked(dataLayer.getJournalEntries).mockResolvedValue([
      makeJournalEntry({ id: "entry_2", reverses_entry_id: "entry_1", accounting_period_id: "period_1" }),
    ]);

    renderView();

    expect(await screen.findAllByText("Reversal")).not.toHaveLength(0);
  });

  it("re-fetches with the selected posting status filter", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getJournalEntries).mockResolvedValue([]);

    renderView();
    await waitFor(() => expect(dataLayer.getJournalEntries).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/filter by posting status/i), "posted");

    await waitFor(() =>
      expect(dataLayer.getJournalEntries).toHaveBeenLastCalledWith(
        expect.objectContaining({ postingStatus: "posted", limit: 25, offset: 0 }),
      ),
    );
  });

  it("paginates forward using limit/offset", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getJournalEntries).mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => makeJournalEntry({ id: `entry_${i}`, accounting_period_id: "period_1" })),
    );

    renderView();
    await waitFor(() => expect(dataLayer.getJournalEntries).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() =>
      expect(dataLayer.getJournalEntries).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 25 })),
    );
  });

  it("shows the Record Manual Adjustment button only with finance.create", async () => {
    mockCommon();
    vi.mocked(dataLayer.getJournalEntries).mockResolvedValue([]);

    renderView(["finance.view"]);

    await screen.findByText(/no journal entries yet/i);
    expect(screen.queryByRole("link", { name: /record manual adjustment/i })).not.toBeInTheDocument();
  });

  it("shows an empty state when no entries match", async () => {
    mockCommon();
    vi.mocked(dataLayer.getJournalEntries).mockResolvedValue([]);

    renderView();

    expect(await screen.findByText(/no journal entries yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    mockCommon();
    vi.mocked(dataLayer.getJournalEntries).mockRejectedValue(new Error("boom"));

    renderView();

    expect(await screen.findByText(/could not load journal entries/i)).toBeInTheDocument();
  });
});
