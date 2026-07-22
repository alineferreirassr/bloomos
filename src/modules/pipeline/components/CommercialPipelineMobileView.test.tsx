import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommercialPipelineMobileView } from "@/modules/pipeline/components/CommercialPipelineMobileView";
import { groupLeadsByColumn } from "@/modules/pipeline/logic";
import { buildQuickActions } from "@/modules/pipeline/quickActions";
import { makeLead } from "@/modules/leads/testUtils";
import type { Lead } from "@/types/lead";

function buildActions(lead: Lead) {
  return buildQuickActions(lead, {
    can: () => true,
    onOpen: vi.fn(),
    onAssignTeam: vi.fn(),
    onScheduleConsultation: vi.fn(),
    onSendProposal: vi.fn(),
    onMoveToWaitingDecision: vi.fn(),
    onMarkLost: vi.fn(),
    onArchive: vi.fn(),
    onBookLead: vi.fn(),
  });
}

describe("CommercialPipelineMobileView", () => {
  it("shows only the selected stage's Leads (single-stage view)", () => {
    const leads = [
      makeLead({ id: "l1", first_name: "Amy", last_name: "New", status: "new" }),
      makeLead({ id: "l2", first_name: "Quinn", last_name: "Qualified", status: "qualified" }),
    ];
    render(<CommercialPipelineMobileView columns={groupLeadsByColumn(leads)} buildActions={buildActions} />);

    expect(screen.getByText("Amy New")).toBeInTheDocument();
    expect(screen.queryByText("Quinn Qualified")).not.toBeInTheDocument();
  });

  it("switches which Leads are shown when the stage selector changes", async () => {
    const leads = [
      makeLead({ id: "l1", first_name: "Amy", last_name: "New", status: "new" }),
      makeLead({ id: "l2", first_name: "Quinn", last_name: "Qualified", status: "qualified" }),
    ];
    render(<CommercialPipelineMobileView columns={groupLeadsByColumn(leads)} buildActions={buildActions} />);

    await userEvent.selectOptions(screen.getByLabelText(/select pipeline stage/i), "qualified");

    expect(screen.queryByText("Amy New")).not.toBeInTheDocument();
    expect(screen.getByText("Quinn Qualified")).toBeInTheDocument();
  });

  it("shows an empty message for a stage with no Leads", async () => {
    render(<CommercialPipelineMobileView columns={groupLeadsByColumn([])} buildActions={buildActions} />);
    expect(screen.getByText(/no leads in this stage/i)).toBeInTheDocument();
  });

  it("renders each card without a drag handle (draggable=false)", () => {
    const leads = [makeLead({ id: "l1", first_name: "Amy", last_name: "New", status: "new" })];
    render(<CommercialPipelineMobileView columns={groupLeadsByColumn(leads)} buildActions={buildActions} />);
    expect(screen.queryByLabelText(/drag amy new's card/i)).not.toBeInTheDocument();
  });

  it("still exposes Quick Actions per card on mobile", async () => {
    const leads = [makeLead({ id: "l1", first_name: "Amy", last_name: "New", status: "new" })];
    render(<CommercialPipelineMobileView columns={groupLeadsByColumn(leads)} buildActions={buildActions} />);

    await userEvent.click(screen.getByRole("button", { name: /item actions/i }));
    expect(screen.getByRole("menuitem", { name: "Open Lead" })).toBeInTheDocument();
  });
});
