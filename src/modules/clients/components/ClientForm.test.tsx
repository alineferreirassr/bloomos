import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientForm } from "@/modules/clients/components/ClientForm";
import { makeClient } from "@/modules/clients/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ClientForm", () => {
  it("shows validation errors for missing required fields and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ClientForm submitLabel="Create Client" cancelHref="/clients" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /create client/i }));

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ClientForm submitLabel="Create Client" cancelHref="/clients" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/first name/i), "Priya");
    await user.type(screen.getByLabelText(/last name/i), "Nair");
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /create client/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the entered contact fields once required fields are valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeClient() });
    render(<ClientForm submitLabel="Create Client" cancelHref="/clients" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/first name/i), "Priya");
    await user.type(screen.getByLabelText(/last name/i), "Nair");
    await user.type(screen.getByLabelText(/email/i), "priya@example.com");
    await user.click(screen.getByRole("button", { name: /create client/i }));

    await screen.findByRole("button", { name: /create client/i });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Priya",
        last_name: "Nair",
        email: "priya@example.com",
        important_dates: [],
        do_not_call: false,
        surprise_event_confidentiality: false,
      }),
    );
  });

  it("adds and removes an important date row", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeClient() });
    render(<ClientForm submitLabel="Create Client" cancelHref="/clients" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /add important date/i }));
    expect(screen.getByLabelText(/^label$/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(screen.queryByLabelText(/^label$/i)).not.toBeInTheDocument();
  });
});
