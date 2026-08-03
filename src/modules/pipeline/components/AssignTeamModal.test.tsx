import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignTeamModal } from "@/modules/pipeline/components/AssignTeamModal";
import { makeLead } from "@/modules/leads/testUtils";

vi.mock("@/lib/data", () => ({ updateLead: vi.fn() }));
import * as dataLayer from "@/lib/data";

describe("AssignTeamModal", () => {
  it("resubmits the full Lead form with only assigned_to changed", async () => {
    const lead = makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", assigned_to: "Jamie" });
    vi.mocked(dataLayer.updateLead).mockResolvedValue({ success: true, data: { ...lead, assigned_to: "Alex" } });
    const onAssigned = vi.fn();

    render(<AssignTeamModal lead={lead} open onClose={vi.fn()} onAssigned={onAssigned} />);

    const input = screen.getByLabelText(/assigned to/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Alex");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(dataLayer.updateLead).toHaveBeenCalledWith(
      "l1",
      expect.objectContaining({ first_name: "Priya", last_name: "Nair", assigned_to: "Alex" }),
    );
    expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: "Alex" }));
  });

  it("shows an inline error and does not call onAssigned when the update fails", async () => {
    const lead = makeLead({ id: "l1" });
    vi.mocked(dataLayer.updateLead).mockResolvedValue({ success: false, error: "Please fix the highlighted fields." });
    const onAssigned = vi.fn();

    render(<AssignTeamModal lead={lead} open onClose={vi.fn()} onAssigned={onAssigned} />);
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText("Please fix the highlighted fields.")).toBeInTheDocument();
    expect(onAssigned).not.toHaveBeenCalled();
  });
});
