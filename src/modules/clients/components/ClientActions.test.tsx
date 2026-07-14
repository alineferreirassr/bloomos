import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientActions } from "@/modules/clients/components/ClientActions";
import { makeClient } from "@/modules/clients/testUtils";

vi.mock("@/lib/data", () => ({
  archiveClient: vi.fn(),
  restoreClient: vi.fn(),
  setClientVipStatus: vi.fn(),
  updateClientStatus: vi.fn(),
  updateClientContactPreference: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ClientActions — VIP toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically flips the button label and calls setClientVipStatus", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.setClientVipStatus).mockResolvedValue({
      success: true,
      data: makeClient({ is_vip: true }),
    });
    const onChanged = vi.fn();

    render(<ClientActions client={makeClient({ id: "client_1", is_vip: false })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /mark as vip/i }));

    expect(screen.getByRole("button", { name: /remove vip/i })).toBeInTheDocument();
    await waitFor(() => expect(dataLayer.setClientVipStatus).toHaveBeenCalledWith("client_1", true));
    expect(onChanged).toHaveBeenCalled();
  });

  it("rolls back the optimistic update if the mutation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.setClientVipStatus).mockResolvedValue({
      success: false,
      error: "Client not found.",
    });
    const onChanged = vi.fn();

    render(<ClientActions client={makeClient({ id: "client_1", is_vip: false })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /mark as vip/i }));

    await screen.findByText(/client not found/i);
    expect(screen.getByRole("button", { name: /mark as vip/i })).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("ClientActions — archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls archiveClient and reports the change", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveClient).mockResolvedValue({
      success: true,
      data: makeClient({ internal_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();

    render(<ClientActions client={makeClient({ id: "client_1" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveClient).toHaveBeenCalledWith("client_1"));
    expect(onChanged).toHaveBeenCalled();
  });
});

describe("ClientActions — restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls restoreClient and reports the change", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.restoreClient).mockResolvedValue({
      success: true,
      data: makeClient({ id: "client_1", internal_status: "active", archived_at: null }),
    });
    const onChanged = vi.fn();

    render(
      <ClientActions
        client={makeClient({ id: "client_1", internal_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" })}
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(dataLayer.restoreClient).toHaveBeenCalledWith("client_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not show Edit or VIP toggle for an archived client", () => {
    render(
      <ClientActions
        client={makeClient({ internal_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" })}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as vip/i })).not.toBeInTheDocument();
  });
});
