import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignTeamModal } from "@/modules/pipeline/components/AssignTeamModal";
import { makeLead } from "@/modules/leads/testUtils";

vi.mock("@/lib/data", () => ({ updateLeadAssignment: vi.fn() }));
import * as dataLayer from "@/lib/data";

describe("AssignTeamModal — SOCIAL-13E", () => {
  it("calls the isolated updateLeadAssignment path with workspace_id + lead id + the new value — never the full form", async () => {
    const lead = makeLead({ id: "l1", workspace_id: "ws_1", first_name: "Priya", last_name: "Nair", assigned_to: "Jamie" });
    vi.mocked(dataLayer.updateLeadAssignment).mockResolvedValue({ success: true, data: { ...lead, assigned_to: "Alex" } });
    const onAssigned = vi.fn();

    render(<AssignTeamModal lead={lead} open onClose={vi.fn()} onAssigned={onAssigned} />);

    const input = screen.getByLabelText(/assigned to/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Alex");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(dataLayer.updateLeadAssignment).toHaveBeenCalledWith("ws_1", "l1", "Alex");
    expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: "Alex" }));
  });

  it("assigns an Instagram-originated Lead with null first_name/last_name/email — no field-validation error, since this never resubmits the full form", async () => {
    const instagramLead = makeLead({
      id: "l2",
      workspace_id: "ws_1",
      first_name: null,
      last_name: null,
      email: null,
      instagram: "@curious_bride",
      instagram_external_id: "17841400000000001",
      source: "Instagram",
      assigned_to: null,
    });
    vi.mocked(dataLayer.updateLeadAssignment).mockResolvedValue({ success: true, data: { ...instagramLead, assigned_to: "Aline Ferreira" } });
    const onAssigned = vi.fn();

    render(<AssignTeamModal lead={instagramLead} open onClose={vi.fn()} onAssigned={onAssigned} />);

    const input = screen.getByLabelText(/assigned to/i);
    await userEvent.type(input, "Aline Ferreira");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(dataLayer.updateLeadAssignment).toHaveBeenCalledWith("ws_1", "l2", "Aline Ferreira");
    expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: "Aline Ferreira" }));
  });

  it("supports clearing the field to unassign", async () => {
    const lead = makeLead({ id: "l1", workspace_id: "ws_1", assigned_to: "Jamie" });
    vi.mocked(dataLayer.updateLeadAssignment).mockResolvedValue({ success: true, data: { ...lead, assigned_to: null } });
    const onAssigned = vi.fn();

    render(<AssignTeamModal lead={lead} open onClose={vi.fn()} onAssigned={onAssigned} />);
    await userEvent.clear(screen.getByLabelText(/assigned to/i));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(dataLayer.updateLeadAssignment).toHaveBeenCalledWith("ws_1", "l1", "");
    expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: null }));
  });

  it("shows an inline error and does not call onAssigned when the update fails", async () => {
    const lead = makeLead({ id: "l1", workspace_id: "ws_1" });
    vi.mocked(dataLayer.updateLeadAssignment).mockResolvedValue({ success: false, error: "Lead not found." });
    const onAssigned = vi.fn();

    render(<AssignTeamModal lead={lead} open onClose={vi.fn()} onAssigned={onAssigned} />);
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText("Lead not found.")).toBeInTheDocument();
    expect(onAssigned).not.toHaveBeenCalled();
  });
});
