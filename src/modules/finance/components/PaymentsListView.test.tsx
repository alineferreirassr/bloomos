import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentsListView } from "@/modules/finance/components/PaymentsListView";
import { makePayment } from "@/modules/finance/testUtils";
import { makeClient } from "@/modules/clients/testUtils";

vi.mock("@/lib/data", () => ({
  getPayments: vi.fn(),
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getInvoices: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([
    makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" }),
  ]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);
}

describe("PaymentsListView", () => {
  it("renders payments sorted by transaction date, newest first", async () => {
    mockCommon();
    vi.mocked(dataLayer.getPayments).mockResolvedValue([
      makePayment({ id: "p_old", client_id: "client_1", transaction_date: "2026-01-01", reference: "OLD" }),
      makePayment({ id: "p_new", client_id: "client_1", transaction_date: "2026-06-01", reference: "NEW" }),
    ]);

    render(<PaymentsListView />);

    const refs = await screen.findAllByText(/^(OLD|NEW)$/);
    expect(refs[0]).toHaveTextContent("NEW");
  });

  it("re-fetches with the entered search text", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getPayments).mockResolvedValue([]);

    render(<PaymentsListView />);
    await waitFor(() => expect(dataLayer.getPayments).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/search payments/i), "jordan");

    await waitFor(() =>
      expect(dataLayer.getPayments).toHaveBeenLastCalledWith(expect.objectContaining({ search: "jordan" })),
    );
  });

  it("re-fetches with the selected type filter", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getPayments).mockResolvedValue([]);

    render(<PaymentsListView />);
    await waitFor(() => expect(dataLayer.getPayments).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/filter by type/i), "refund");

    await waitFor(() =>
      expect(dataLayer.getPayments).toHaveBeenLastCalledWith(expect.objectContaining({ paymentType: "refund" })),
    );
  });

  it("re-fetches with refundsOnly when the checkbox is checked", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getPayments).mockResolvedValue([]);

    render(<PaymentsListView />);
    await waitFor(() => expect(dataLayer.getPayments).toHaveBeenCalled());

    await user.click(screen.getByRole("checkbox", { name: /refunds only/i }));

    await waitFor(() =>
      expect(dataLayer.getPayments).toHaveBeenLastCalledWith(expect.objectContaining({ refundsOnly: true })),
    );
  });

  it("shows an empty state when no payments match", async () => {
    mockCommon();
    vi.mocked(dataLayer.getPayments).mockResolvedValue([]);

    render(<PaymentsListView />);

    expect(await screen.findByText(/no payments yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    mockCommon();
    vi.mocked(dataLayer.getPayments).mockRejectedValue(new Error("boom"));

    render(<PaymentsListView />);

    expect(await screen.findByText(/could not load payments/i)).toBeInTheDocument();
  });
});
