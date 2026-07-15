import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContractForm } from "@/modules/contracts/components/ContractForm";
import { makeContract } from "@/modules/contracts/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

async function waitForClientOptions() {
  const select = await screen.findByLabelText(/^client\b/i);
  await waitFor(() => {
    expect(within(select).getAllByRole("option").length).toBeGreaterThan(1);
  });
  return select;
}

describe("ContractForm", () => {
  it("shows validation errors for missing required fields and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ContractForm submitLabel="Create Contract" cancelHref="/contracts" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /create contract/i }));

    expect(await screen.findByText(/client is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an expiration date before the effective date", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ContractForm submitLabel="Create Contract" cancelHref="/contracts" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Test Contract");
    await user.type(screen.getByLabelText(/effective date/i), "2026-06-10");
    await user.type(screen.getByLabelText(/expiration date/i), "2026-06-01");
    await user.click(screen.getByRole("button", { name: /create contract/i }));

    expect(await screen.findByText(/expiration date cannot be before the effective date/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires a deposit amount once deposit required is checked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ContractForm submitLabel="Create Contract" cancelHref="/contracts" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Test Contract");
    await user.click(screen.getByLabelText(/deposit required/i));
    await user.click(screen.getByRole("button", { name: /create contract/i }));

    expect(await screen.findByText(/enter a deposit amount/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a deposit amount greater than the total value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ContractForm submitLabel="Create Contract" cancelHref="/contracts" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Test Contract");
    await user.type(screen.getByLabelText(/total value/i), "1000");
    await user.click(screen.getByLabelText(/deposit required/i));
    await user.type(screen.getByLabelText(/deposit amount/i), "2000");
    await user.click(screen.getByRole("button", { name: /create contract/i }));

    expect(
      await screen.findByText(/deposit amount cannot exceed the total contract value/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the entered fields once required fields are valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeContract() });
    render(<ContractForm submitLabel="Create Contract" cancelHref="/contracts" onSubmit={onSubmit} />);

    const clientSelect = await waitForClientOptions();
    await user.selectOptions(clientSelect, "client_1");
    await user.type(screen.getByLabelText(/^title\b/i), "Whitfield Retainer Agreement");
    await user.click(screen.getByRole("button", { name: /create contract/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client_1",
        title: "Whitfield Retainer Agreement",
        currency: "USD",
      }),
    );
  });

  it("filters the Event dropdown to the selected Client's own Events, preventing an invalid Client/Event pairing", async () => {
    const user = userEvent.setup();
    render(<ContractForm submitLabel="Create Contract" cancelHref="/contracts" onSubmit={vi.fn()} />);

    const clientSelect = await waitForClientOptions();
    // client_2 (Jordan Ellis) owns event_1 (Malibu Sunset Proposal)
    await user.selectOptions(clientSelect, "client_2");
    const eventSelect = screen.getByLabelText(/^event\b/i);
    await waitFor(() => {
      expect(within(eventSelect).getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    });

    // client_1 (Naomi Whitfield) does not own event_1 — switching clients must clear it from the options
    await user.selectOptions(clientSelect, "client_1");
    await waitFor(() => {
      expect(within(eventSelect).queryByText("Malibu Sunset Proposal")).not.toBeInTheDocument();
    });
  });
});
