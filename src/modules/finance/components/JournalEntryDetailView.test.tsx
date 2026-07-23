import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalEntryDetailView } from "@/modules/finance/components/JournalEntryDetailView";
import { makeJournalEntry, makeJournalLine, makeAccountingPeriod } from "@/modules/finance/testUtils";
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

function renderDetail(journalEntryId = "entry_1", permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <JournalEntryDetailView journalEntryId={journalEntryId} />
    </MemberSessionProvider>,
  );
}

vi.mock("@/lib/data", () => ({
  getJournalEntry: vi.fn(),
  getAccountingPeriod: vi.fn(),
  reverseJournalEntry: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("JournalEntryDetailView", () => {
  it("renders lines with matching debit and credit totals", async () => {
    vi.mocked(dataLayer.getJournalEntry).mockResolvedValue(
      makeJournalEntry({
        id: "entry_1",
        lines: [
          makeJournalLine({ id: "line_1", debit_minor: 10000, credit_minor: 0, account: { account_number: 1000, name: "Cash", account_type: "asset" } }),
          makeJournalLine({ id: "line_2", debit_minor: 0, credit_minor: 10000, account: { account_number: 4000, name: "Revenue", account_type: "revenue" } }),
        ],
      }),
    );
    vi.mocked(dataLayer.getAccountingPeriod).mockResolvedValue(makeAccountingPeriod());

    renderDetail();

    expect((await screen.findAllByText("1000 — Cash")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("4000 — Revenue").length).toBeGreaterThan(0);
    const totalDebits = screen.getAllByText("$100.00");
    expect(totalDebits.length).toBeGreaterThanOrEqual(2); // one line + the Total row, both sides balanced
  });

  it("shows reversal linkage when this entry reverses another", async () => {
    vi.mocked(dataLayer.getJournalEntry).mockResolvedValue(
      makeJournalEntry({ id: "entry_2", reverses_entry_id: "entry_1", lines: [] }),
    );
    vi.mocked(dataLayer.getAccountingPeriod).mockResolvedValue(makeAccountingPeriod());

    renderDetail("entry_2");

    expect(await screen.findByText(/this entry reverses/i)).toBeInTheDocument();
  });

  it("hides Reverse Entry once the entry has already been reversed", async () => {
    vi.mocked(dataLayer.getJournalEntry).mockResolvedValue(
      makeJournalEntry({ id: "entry_1", reversed_by_entry_id: "entry_2", lines: [] }),
    );
    vi.mocked(dataLayer.getAccountingPeriod).mockResolvedValue(makeAccountingPeriod());

    renderDetail();

    await screen.findByText(/this entry was reversed by/i);
    expect(screen.queryByRole("button", { name: /reverse entry/i })).not.toBeInTheDocument();
  });

  it("hides Reverse Entry without finance.create", async () => {
    vi.mocked(dataLayer.getJournalEntry).mockResolvedValue(makeJournalEntry({ id: "entry_1", lines: [] }));
    vi.mocked(dataLayer.getAccountingPeriod).mockResolvedValue(makeAccountingPeriod());

    renderDetail("entry_1", ["finance.view"]);

    await waitFor(() => expect(dataLayer.getJournalEntry).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /reverse entry/i })).not.toBeInTheDocument();
  });

  it("reverses through a confirmation dialog requiring a reason", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getJournalEntry).mockResolvedValue(makeJournalEntry({ id: "entry_1", lines: [] }));
    vi.mocked(dataLayer.getAccountingPeriod).mockResolvedValue(makeAccountingPeriod());
    vi.mocked(dataLayer.reverseJournalEntry).mockResolvedValue({
      success: true,
      data: makeJournalEntry({ id: "entry_2", reverses_entry_id: "entry_1" }),
    });

    renderDetail();
    await screen.findByRole("button", { name: /reverse entry/i });

    await user.click(screen.getByRole("button", { name: /reverse entry/i }));
    const dialog = screen.getByRole("dialog", { name: /reverse journal entry/i });

    await user.click(within(dialog).getByRole("button", { name: /^reverse entry$/i }));
    expect(await within(dialog).findByText(/a reversal reason is required/i)).toBeInTheDocument();
    expect(dataLayer.reverseJournalEntry).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/reversal reason/i), "Posted to the wrong account");
    await user.click(within(dialog).getByRole("button", { name: /^reverse entry$/i }));

    await waitFor(() =>
      expect(dataLayer.reverseJournalEntry).toHaveBeenCalledWith("entry_1", { reason: "Posted to the wrong account" }),
    );
  });

  it("shows an error state when loading fails", async () => {
    vi.mocked(dataLayer.getJournalEntry).mockRejectedValue(new Error("boom"));

    renderDetail();

    expect(await screen.findByText(/could not load this journal entry/i)).toBeInTheDocument();
  });
});
