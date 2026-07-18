import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseActions } from "@/modules/finance/components/ExpenseActions";
import { makeExpense } from "@/modules/finance/testUtils";
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

function renderExpenseActions(props: Parameters<typeof ExpenseActions>[0], permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <ExpenseActions {...props} />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  approveExpense: vi.fn(),
  archiveExpense: vi.fn(),
  cancelExpense: vi.fn(),
  duplicateExpense: vi.fn(),
  markExpenseDue: vi.fn(),
  markExpensePaid: vi.fn(),
  markExpenseReimbursed: vi.fn(),
  restoreExpense: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ExpenseActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Edit, Approve, Cancel, Archive, and Duplicate for a planned expense", () => {
    renderExpenseActions({ expense: makeExpense({ status: "planned" }), onChanged: vi.fn() });
    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^duplicate$/i })).toBeInTheDocument();
  });

  it("shows Mark Due and Mark Paid for an approved expense", () => {
    renderExpenseActions({ expense: makeExpense({ status: "approved" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /mark due/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark paid/i })).toBeInTheDocument();
  });

  it("shows Mark Reimbursed only for a paid, reimbursable expense", () => {
    renderExpenseActions({ expense: makeExpense({ status: "paid", reimbursable: true }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /mark reimbursed/i })).toBeInTheDocument();
  });

  it("hides Mark Reimbursed for a paid, non-reimbursable expense", () => {
    renderExpenseActions({ expense: makeExpense({ status: "paid", reimbursable: false }), onChanged: vi.fn() });
    expect(screen.queryByRole("button", { name: /mark reimbursed/i })).not.toBeInTheDocument();
  });

  it("shows only Restore and Duplicate for an archived expense", () => {
    renderExpenseActions({ expense: makeExpense({ status: "archived" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^duplicate$/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("approves directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.approveExpense).mockResolvedValue({
      success: true,
      data: makeExpense({ status: "approved" }),
    });
    const onChanged = vi.fn();
    renderExpenseActions({ expense: makeExpense({ id: "expense_1", status: "planned" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => expect(dataLayer.approveExpense).toHaveBeenCalledWith("expense_1"));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks paid directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markExpensePaid).mockResolvedValue({
      success: true,
      data: makeExpense({ status: "paid" }),
    });
    const onChanged = vi.fn();
    renderExpenseActions({ expense: makeExpense({ id: "expense_1", status: "due" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /mark paid/i }));

    await waitFor(() => expect(dataLayer.markExpensePaid).toHaveBeenCalledWith("expense_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("marks reimbursed directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.markExpenseReimbursed).mockResolvedValue({
      success: true,
      data: makeExpense({ status: "reimbursed" }),
    });
    const onChanged = vi.fn();
    renderExpenseActions({
      expense: makeExpense({ id: "expense_1", status: "paid", reimbursable: true }),
      onChanged,
    });

    await user.click(screen.getByRole("button", { name: /mark reimbursed/i }));

    await waitFor(() => expect(dataLayer.markExpenseReimbursed).toHaveBeenCalledWith("expense_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("cancels through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.cancelExpense).mockResolvedValue({
      success: true,
      data: makeExpense({ status: "cancelled" }),
    });
    const onChanged = vi.fn();
    renderExpenseActions({ expense: makeExpense({ id: "expense_1", status: "planned" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    const dialog = screen.getByRole("dialog", { name: /cancel expense/i });
    await user.click(within(dialog).getByRole("button", { name: /cancel expense/i }));

    await waitFor(() => expect(dataLayer.cancelExpense).toHaveBeenCalledWith("expense_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("archives through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveExpense).mockResolvedValue({
      success: true,
      data: makeExpense({ status: "archived" }),
    });
    const onChanged = vi.fn();
    renderExpenseActions({ expense: makeExpense({ id: "expense_1", status: "planned" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive expense/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveExpense).toHaveBeenCalledWith("expense_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("duplicates directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.duplicateExpense).mockResolvedValue({
      success: true,
      data: makeExpense({ id: "expense_2" }),
    });
    renderExpenseActions({ expense: makeExpense({ id: "expense_1", status: "planned" }), onChanged: vi.fn() });

    await user.click(screen.getByRole("button", { name: /^duplicate$/i }));

    await waitFor(() => expect(dataLayer.duplicateExpense).toHaveBeenCalledWith("expense_1"));
  });

  it("surfaces an error and does not call onChanged when a quick action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.approveExpense).mockResolvedValue({
      success: false,
      error: "Cannot approve an expense that is already cancelled.",
    });
    const onChanged = vi.fn();
    renderExpenseActions({ expense: makeExpense({ id: "expense_1", status: "planned" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    expect(await screen.findByText(/cannot approve an expense that is already cancelled/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
