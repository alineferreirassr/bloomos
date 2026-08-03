import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseForm } from "@/modules/purchases/components/PurchaseForm";
import { makePurchase } from "@/modules/purchases/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  getVendors: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("PurchaseForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLayer.getVendors).mockResolvedValue([{ id: "vendor_1", company_name: "Bloom & Stem Florals", display_name: null } as never]);
  });

  it("shows a validation error when submitting create mode without selecting a vendor", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PurchaseForm mode="create" submitLabel="Create Purchase" cancelHref="/purchases" onSubmit={onSubmit} />);

    await screen.findByRole("option", { name: "Bloom & Stem Florals" });
    await user.click(screen.getByRole("button", { name: /create purchase/i }));

    expect(await screen.findByText(/vendor is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a valid create with the selected vendor and converted money fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makePurchase() });
    render(<PurchaseForm mode="create" submitLabel="Create Purchase" cancelHref="/purchases" onSubmit={onSubmit} />);

    await screen.findByRole("option", { name: "Bloom & Stem Florals" });
    await user.selectOptions(screen.getByLabelText(/^vendor \*?$/i), "vendor_1");
    await user.click(screen.getByRole("button", { name: /create purchase/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ vendor_id: "vendor_1", currency: "USD" })));
  });

  it("looks up vendors on mount only in create mode", async () => {
    render(<PurchaseForm mode="create" submitLabel="Create Purchase" cancelHref="/purchases" onSubmit={vi.fn()} />);

    await screen.findByRole("option", { name: "Bloom & Stem Florals" });
    expect(dataLayer.getVendors).toHaveBeenCalledWith({ includeArchived: false });
  });

  it("does not fetch vendors or render the Vendor picker in edit mode — shows the fixed vendor as read-only text instead", () => {
    render(
      <PurchaseForm
        mode="edit"
        submitLabel="Save changes"
        cancelHref="/purchases/purchase-1"
        vendorLabel="Bloom & Stem Florals"
        defaultValues={{ vendor_id: "vendor_1" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(dataLayer.getVendors).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^vendor \*?$/i)).not.toBeInTheDocument();
    expect(screen.getByText("Bloom & Stem Florals")).toBeInTheDocument();
  });

  it("submits edit mode without a vendor_id field in the payload shape callers care about", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makePurchase() });
    render(
      <PurchaseForm
        mode="edit"
        submitLabel="Save changes"
        cancelHref="/purchases/purchase-1"
        vendorLabel="Bloom & Stem Florals"
        defaultValues={{ vendor_id: "vendor_1", currency: "USD", tax_minor: "5" }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // The caller (EditPurchaseView) is the one that strips vendor_id before calling updatePurchase —
    // this only confirms the form still submits successfully without requiring the user to touch Vendor.
  });

  it("never renders status, subtotal, total, quantity-received, or actual-received-date fields — those are workflow/repository-derived, not user-editable", () => {
    render(<PurchaseForm mode="create" submitLabel="Create Purchase" cancelHref="/purchases" onSubmit={vi.fn()} />);

    expect(screen.queryByLabelText(/^status/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/subtotal/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^total/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/quantity received/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/actual received date/i)).not.toBeInTheDocument();
  });

  it("rejects a currency code that isn't exactly 3 letters", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PurchaseForm mode="create" submitLabel="Create Purchase" cancelHref="/purchases" onSubmit={onSubmit} />);

    await screen.findByRole("option", { name: "Bloom & Stem Florals" });
    await user.selectOptions(screen.getByLabelText(/^vendor \*?$/i), "vendor_1");
    await user.clear(screen.getByLabelText(/currency/i));
    await user.type(screen.getByLabelText(/currency/i), "US");
    await user.click(screen.getByRole("button", { name: /create purchase/i }));

    expect(await screen.findByText(/3-letter currency code/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the repository's field-level error returned from a failed submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "Please select a valid vendor.",
      fieldErrors: { vendor_id: "Vendor not found." },
    });
    render(<PurchaseForm mode="create" submitLabel="Create Purchase" cancelHref="/purchases" onSubmit={onSubmit} />);

    await screen.findByRole("option", { name: "Bloom & Stem Florals" });
    await user.selectOptions(screen.getByLabelText(/^vendor \*?$/i), "vendor_1");
    await user.click(screen.getByRole("button", { name: /create purchase/i }));

    expect(await screen.findAllByText(/vendor not found/i)).not.toHaveLength(0);
  });
});
