import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagsEditor } from "@/modules/clients/components/TagsEditor";

vi.mock("@/lib/data", () => ({
  updateClientTags: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("TagsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a tag on Enter and calls updateClientTags", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateClientTags).mockResolvedValue({
      success: true,
      data: expect.anything(),
    } as never);
    const onChanged = vi.fn();

    render(<TagsEditor clientId="client_1" tags={[]} onChanged={onChanged} />);

    await user.type(screen.getByLabelText(/add a tag/i), "vip{Enter}");

    expect(screen.getByText("vip")).toBeInTheDocument();
    await waitFor(() => expect(dataLayer.updateClientTags).toHaveBeenCalledWith("client_1", ["vip"]));
    expect(onChanged).toHaveBeenCalledWith(["vip"]);
  });

  it("removes a tag when its remove button is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateClientTags).mockResolvedValue({
      success: true,
      data: expect.anything(),
    } as never);
    const onChanged = vi.fn();

    render(<TagsEditor clientId="client_1" tags={["vip", "referral"]} onChanged={onChanged} />);

    await user.click(screen.getByLabelText(/remove tag vip/i));

    expect(screen.queryByText("vip")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(dataLayer.updateClientTags).toHaveBeenCalledWith("client_1", ["referral"]),
    );
  });

  it("rolls back if the mutation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateClientTags).mockResolvedValue({
      success: false,
      error: "Client not found.",
    });
    const onChanged = vi.fn();

    render(<TagsEditor clientId="client_1" tags={[]} onChanged={onChanged} />);

    await user.type(screen.getByLabelText(/add a tag/i), "vip{Enter}");

    await screen.findByText(/client not found/i);
    expect(screen.queryByText("vip")).not.toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
