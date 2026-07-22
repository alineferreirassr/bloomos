import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendorActions } from "@/modules/vendors/components/VendorActions";
import { makeVendor } from "@/modules/vendors/testUtils";

vi.mock("@/lib/data", () => ({
  archiveVendor: vi.fn(),
  restoreVendor: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("VendorActions — archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls archiveVendor and reports the change", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveVendor).mockResolvedValue({
      success: true,
      data: makeVendor({ archived_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();

    render(<VendorActions vendor={makeVendor({ id: "vendor_1" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveVendor).toHaveBeenCalledWith("vendor_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows the repository error and does not call onChanged when archiving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveVendor).mockResolvedValue({
      success: false,
      error: "This vendor is already archived.",
    });
    const onChanged = vi.fn();

    render(<VendorActions vendor={makeVendor({ id: "vendor_1" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText(/already archived/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("VendorActions — restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls restoreVendor and reports the change", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.restoreVendor).mockResolvedValue({
      success: true,
      data: makeVendor({ id: "vendor_1", archived_at: null }),
    });
    const onChanged = vi.fn();

    render(
      <VendorActions
        vendor={makeVendor({ id: "vendor_1", archived_at: "2026-01-01T00:00:00.000Z" })}
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(dataLayer.restoreVendor).toHaveBeenCalledWith("vendor_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not show Edit for an archived vendor", () => {
    render(
      <VendorActions
        vendor={makeVendor({ archived_at: "2026-01-01T00:00:00.000Z" })}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
  });
});
