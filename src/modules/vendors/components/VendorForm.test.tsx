import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendorForm } from "@/modules/vendors/components/VendorForm";
import { makeVendor } from "@/modules/vendors/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("VendorForm", () => {
  it("shows a validation error for a missing company name and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<VendorForm submitLabel="Create Vendor" cancelHref="/vendors" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /create vendor/i }));

    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<VendorForm submitLabel="Create Vendor" cancelHref="/vendors" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/company name/i), "Bloom & Stem");
    await user.type(screen.getByLabelText(/^email$/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /create vendor/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the entered fields once required fields are valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeVendor() });
    render(<VendorForm submitLabel="Create Vendor" cancelHref="/vendors" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/company name/i), "Bloom & Stem Florals");
    await user.type(screen.getByLabelText(/^email$/i), "hello@bloomandstem.example");
    await user.click(screen.getByRole("button", { name: /create vendor/i }));

    await screen.findByRole("button", { name: /create vendor/i });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: "Bloom & Stem Florals",
        email: "hello@bloomandstem.example",
        default_currency: "USD",
        status: "active",
        is_preferred: false,
        tags: [],
      }),
    );
  });

  it("adds and removes a tag", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeVendor() });
    render(<VendorForm submitLabel="Create Vendor" cancelHref="/vendors" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/add a tag/i), "florist{Enter}");
    expect(screen.getByText("florist")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove tag florist/i }));
    expect(screen.queryByText("florist")).not.toBeInTheDocument();
  });

  it("shows the repository's duplicate Tax ID error as a field-level error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "This Tax ID is already in use in this workspace.",
      fieldErrors: { tax_id: "This Tax ID is already in use in this workspace." },
    });
    render(<VendorForm submitLabel="Create Vendor" cancelHref="/vendors" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/company name/i), "Bloom & Stem Florals");
    await user.type(screen.getByLabelText(/tax id/i), "TAX-10001");
    await user.click(screen.getByRole("button", { name: /create vendor/i }));

    expect(await screen.findAllByText(/already in use in this workspace/i)).not.toHaveLength(0);
  });

  it("disables the submit button while submitting to prevent double submit", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: { success: true; data: ReturnType<typeof makeVendor> }) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<{ success: true; data: ReturnType<typeof makeVendor> }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<VendorForm submitLabel="Create Vendor" cancelHref="/vendors" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/company name/i), "Bloom & Stem Florals");
    await user.click(screen.getByRole("button", { name: /create vendor/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    resolveSubmit({ success: true, data: makeVendor() });
  });
});
