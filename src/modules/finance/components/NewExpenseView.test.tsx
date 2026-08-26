import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewExpenseView } from "@/modules/finance/components/NewExpenseView";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
  createExpense: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeExpense(overrides: Partial<{ id: string }> = {}) {
  return {
    id: "expense_new",
    workspace_id: "ws_1",
    event_id: null,
    client_id: null,
    contract_id: null,
    supplier_id: null,
    team_member_id: null,
    category: "miscellaneous",
    status: "planned",
    description: "Test expense",
    amount_minor: 75000,
    currency: "USD",
    transaction_date: "2026-01-01",
    due_date: null,
    paid_at: null,
    reimbursable: false,
    reimbursed_at: null,
    reference: null,
    notes: null,
    document_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  } as never;
}

function mockCommon() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
}

describe("NewExpenseView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createExpense with a generated expenseId and navigates to the new expense", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense).mockResolvedValue({ success: true, data: makeExpense() });

    render(<NewExpenseView />);
    await screen.findByLabelText(/^client\b/i);
    await user.type(screen.getByLabelText(/description/i), "Florist deposit");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "750");
    await user.click(screen.getByRole("button", { name: /create expense/i }));

    await waitFor(() =>
      expect(dataLayer.createExpense).toHaveBeenCalledWith(expect.objectContaining({ description: "Florist deposit" }), expect.any(String)),
    );
    const expenseId = vi.mocked(dataLayer.createExpense).mock.calls[0][1];
    expect(expenseId.length).toBeGreaterThan(0);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/expenses/expense_new"));
  });

  it("surfaces a translated error from the Repository without navigating", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense).mockResolvedValue({
      success: false,
      error: "The selected event doesn't belong to this client.",
    });

    render(<NewExpenseView />);
    await screen.findByLabelText(/^client\b/i);
    await user.type(screen.getByLabelText(/description/i), "Florist deposit");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "750");
    await user.click(screen.getByRole("button", { name: /create expense/i }));

    expect(await screen.findByText(/doesn't belong to this client/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("reuses the SAME expenseId across a thrown-then-retried submit with an unchanged payload", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makeExpense() });

    render(<NewExpenseView />);
    await screen.findByLabelText(/^client\b/i);
    await user.type(screen.getByLabelText(/description/i), "Florist deposit");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "750");
    const submitButton = screen.getByRole("button", { name: /create expense/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.createExpense).mock.calls[0][1];
    const secondId = vi.mocked(dataLayer.createExpense).mock.calls[1][1];
    expect(secondId).toBe(firstId);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/finance/expenses/expense_new"));
  });

  it("generates a NEW expenseId when the Founder edits the payload after a failed attempt", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.createExpense)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ success: true, data: makeExpense() });

    render(<NewExpenseView />);
    await screen.findByLabelText(/^client\b/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    await user.type(descriptionInput, "Florist deposit");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "750");
    const submitButton = screen.getByRole("button", { name: /create expense/i });
    await user.click(submitButton);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();

    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Rental deposit");
    await user.click(submitButton);

    await waitFor(() => expect(dataLayer.createExpense).toHaveBeenCalledTimes(2));
    const firstId = vi.mocked(dataLayer.createExpense).mock.calls[0][1];
    const secondCall = vi.mocked(dataLayer.createExpense).mock.calls[1];
    expect(secondCall[1]).not.toBe(firstId);
    expect(secondCall[0]).toEqual(expect.objectContaining({ description: "Rental deposit" }));
  });

  it("does not allow a duplicate submit while a request is pending", async () => {
    const user = userEvent.setup();
    mockCommon();
    let resolveCreate: (value: { success: true; data: ReturnType<typeof makeExpense> }) => void;
    vi.mocked(dataLayer.createExpense).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    render(<NewExpenseView />);
    await screen.findByLabelText(/^client\b/i);
    await user.type(screen.getByLabelText(/description/i), "Florist deposit");
    await user.clear(screen.getByLabelText(/^amount\b/i));
    await user.type(screen.getByLabelText(/^amount\b/i), "750");
    const submitButton = screen.getByRole("button", { name: /create expense/i });
    await user.click(submitButton);
    await waitFor(() => expect(submitButton).toBeDisabled());
    await user.click(submitButton);

    expect(dataLayer.createExpense).toHaveBeenCalledTimes(1);
    resolveCreate!({ success: true, data: makeExpense() });
  });
});
