import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExhibitsSection } from "@/modules/contracts/components/ExhibitsSection";
import { makeContractExhibit } from "@/modules/contracts/testUtils";

vi.mock("@/lib/data", () => ({
  createContractExhibit: vi.fn(),
  updateContractExhibit: vi.fn(),
  deleteContractExhibit: vi.fn(),
  reorderContractExhibits: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const exhibits = [
  makeContractExhibit({ id: "exhibit_1", contract_id: "contract_1", title: "Payment Schedule", display_order: 0 }),
  makeContractExhibit({ id: "exhibit_2", contract_id: "contract_1", title: "Cancellation Policy", display_order: 1 }),
];

function getRow(exhibitId: string) {
  return within(screen.getByTestId(`exhibit-${exhibitId}`));
}

async function openMenu(exhibitId: string, user: ReturnType<typeof userEvent.setup>) {
  const row = getRow(exhibitId);
  await user.click(row.getByRole("button", { name: /item actions/i }));
  return row;
}

describe("ExhibitsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every exhibit's title and description", () => {
    render(<ExhibitsSection contractId="contract_1" exhibits={exhibits} readOnly={false} onChanged={vi.fn()} />);
    expect(screen.getByText("Payment Schedule")).toBeInTheDocument();
    expect(screen.getByText("Cancellation Policy")).toBeInTheDocument();
  });

  it("shows an empty message when there are no exhibits", () => {
    render(<ExhibitsSection contractId="contract_1" exhibits={[]} readOnly={false} onChanged={vi.fn()} />);
    expect(screen.getByText(/no exhibits attached/i)).toBeInTheDocument();
  });

  it("hides Add Exhibit, move controls, and the action menu when read-only", () => {
    render(<ExhibitsSection contractId="contract_1" exhibits={exhibits} readOnly onChanged={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /add exhibit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move up/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /item actions/i })).not.toBeInTheDocument();
  });

  it("adds a new exhibit through the modal form", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.createContractExhibit).mockResolvedValue({
      success: true,
      data: makeContractExhibit({ id: "exhibit_3", title: "Rental Terms" }),
    });
    const onChanged = vi.fn();
    render(<ExhibitsSection contractId="contract_1" exhibits={exhibits} readOnly={false} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /add exhibit/i }));
    const dialog = screen.getByRole("dialog", { name: /add exhibit/i });
    await user.type(within(dialog).getByLabelText(/^title\b/i), "Rental Terms");
    await user.click(within(dialog).getByRole("button", { name: /add exhibit/i }));

    await waitFor(() =>
      expect(dataLayer.createContractExhibit).toHaveBeenCalledWith(
        "contract_1",
        expect.objectContaining({ title: "Rental Terms" }),
      ),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("edits an exhibit's title through the action menu", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateContractExhibit).mockResolvedValue({
      success: true,
      data: makeContractExhibit({ id: "exhibit_1", title: "Updated Payment Schedule" }),
    });
    const onChanged = vi.fn();
    render(<ExhibitsSection contractId="contract_1" exhibits={exhibits} readOnly={false} onChanged={onChanged} />);

    await openMenu("exhibit_1", user);
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    const titleInput = screen.getByLabelText(/^title\b/i) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Payment Schedule");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(dataLayer.updateContractExhibit).toHaveBeenCalledWith(
        "exhibit_1",
        expect.objectContaining({ title: "Updated Payment Schedule" }),
      ),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("removes an exhibit after confirming", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.deleteContractExhibit).mockResolvedValue({ success: true, data: null });
    const onChanged = vi.fn();
    render(<ExhibitsSection contractId="contract_1" exhibits={exhibits} readOnly={false} onChanged={onChanged} />);

    await openMenu("exhibit_2", user);
    await user.click(screen.getByRole("menuitem", { name: /remove/i }));
    const dialog = screen.getByRole("dialog", { name: /remove exhibit/i });
    await user.click(within(dialog).getByRole("button", { name: /^remove$/i }));

    await waitFor(() => expect(dataLayer.deleteContractExhibit).toHaveBeenCalledWith("exhibit_2"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("reorders exhibits with the move-down control", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.reorderContractExhibits).mockResolvedValue({ success: true, data: exhibits });
    const onChanged = vi.fn();
    render(<ExhibitsSection contractId="contract_1" exhibits={exhibits} readOnly={false} onChanged={onChanged} />);

    const firstRow = getRow("exhibit_1");
    await user.click(firstRow.getByRole("button", { name: /move down/i }));

    await waitFor(() =>
      expect(dataLayer.reorderContractExhibits).toHaveBeenCalledWith("contract_1", ["exhibit_2", "exhibit_1"]),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("disables Move up for the first exhibit and Move down for the last", () => {
    render(<ExhibitsSection contractId="contract_1" exhibits={exhibits} readOnly={false} onChanged={vi.fn()} />);

    expect(getRow("exhibit_1").getByRole("button", { name: /move up/i })).toBeDisabled();
    expect(getRow("exhibit_2").getByRole("button", { name: /move down/i })).toBeDisabled();
  });
});
