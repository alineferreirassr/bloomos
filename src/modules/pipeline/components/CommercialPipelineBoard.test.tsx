import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommercialPipelineBoard } from "@/modules/pipeline/components/CommercialPipelineBoard";
import { makeLead } from "@/modules/leads/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { Permission } from "@/core/enums/permission";

function snapshotWith(permissions: Permission[]): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
    workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions,
    workspaceDisplayName: "Amoré Bloom",
  };
}

const fullPermissions: Permission[] = ["leads.view", "leads.create", "leads.update", "leads.archive", "events.create"];

function renderBoard(permissions: Permission[] = fullPermissions) {
  render(
    <MemberSessionProvider snapshot={snapshotWith(permissions)}>
      <CommercialPipelineBoard />
    </MemberSessionProvider>,
  );
  // Desktop and mobile both render in jsdom (no real CSS to hide via
  // `hidden`/`md:hidden`) — every content assertion is scoped to the
  // desktop board so it isn't ambiguous with the mobile view's duplicate.
  return () => within(screen.getByTestId("commercial-pipeline-desktop"));
}

vi.mock("@/lib/data", () => ({
  getLeads: vi.fn(),
  updateLeadStatus: vi.fn(),
  archiveLead: vi.fn(),
  updateLead: vi.fn(),
  bookLead: vi.fn(),
  getClientsWithPendingRecovery: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("CommercialPipelineBoard", () => {
  it("shows a loading state before Leads resolve", () => {
    vi.mocked(dataLayer.getLeads).mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <MemberSessionProvider snapshot={snapshotWith(fullPermissions)}>
        <CommercialPipelineBoard />
      </MemberSessionProvider>,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error state with retry when getLeads rejects", async () => {
    vi.mocked(dataLayer.getLeads).mockRejectedValueOnce(new Error("boom"));
    renderBoard();
    expect(await screen.findByText(/could not load the commercial pipeline/i)).toBeInTheDocument();

    vi.mocked(dataLayer.getLeads).mockResolvedValueOnce([]);
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText(/no leads in the commercial pipeline/i)).toBeInTheDocument();
  });

  it("shows an empty-board state when there are no working-status Leads", async () => {
    vi.mocked(dataLayer.getLeads).mockResolvedValue([]);
    renderBoard();
    expect(await screen.findByText(/no leads in the commercial pipeline/i)).toBeInTheDocument();
  });

  it("groups new/contacted/welcome_guide_sent under the single 'Lead' column", async () => {
    vi.mocked(dataLayer.getLeads).mockResolvedValue([
      makeLead({ id: "l1", first_name: "Amy", last_name: "New", status: "new" }),
      makeLead({ id: "l2", first_name: "Ben", last_name: "Contacted", status: "contacted" }),
      makeLead({ id: "l3", first_name: "Cara", last_name: "Guide", status: "welcome_guide_sent" }),
    ]);
    const desktop = renderBoard();
    await screen.findByTestId("commercial-pipeline-desktop");
    expect(desktop().getByText("Amy New")).toBeInTheDocument();
    expect(desktop().getByText("Ben Contacted")).toBeInTheDocument();
    expect(desktop().getByText("Cara Guide")).toBeInTheDocument();
    expect(desktop().getByText("3 leads")).toBeInTheDocument();
  });

  it("excludes converted/lost/archived Leads from the board entirely", async () => {
    vi.mocked(dataLayer.getLeads).mockResolvedValue([
      makeLead({ id: "l1", first_name: "Working", last_name: "Lead", status: "qualified" }),
      makeLead({ id: "l2", first_name: "Gone", last_name: "Converted", status: "converted" }),
    ]);
    const desktop = renderBoard();
    await screen.findByText("Working Lead");
    expect(desktop().queryByText("Gone Converted")).not.toBeInTheDocument();
  });

  it("filters by search text across name/email/event type", async () => {
    vi.mocked(dataLayer.getLeads).mockResolvedValue([
      makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", status: "qualified" }),
      makeLead({ id: "l2", first_name: "Sam", last_name: "Ortiz", status: "qualified" }),
    ]);
    const desktop = renderBoard();
    await screen.findByText("Priya Nair");

    await userEvent.type(screen.getAllByLabelText(/search leads/i)[0], "priya");
    expect(desktop().getByText("Priya Nair")).toBeInTheDocument();
    expect(desktop().queryByText("Sam Ortiz")).not.toBeInTheDocument();
  });

  it("only shows permission-allowed Quick Actions", async () => {
    vi.mocked(dataLayer.getLeads).mockResolvedValue([
      makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", status: "qualified" }),
    ]);
    const desktop = renderBoard(["leads.view"]);
    await screen.findByText("Priya Nair");

    await userEvent.click(desktop().getByRole("button", { name: /item actions/i }));
    const menu = desktop().getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Open Lead" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Archive" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Book Lead" })).not.toBeInTheDocument();
  });

  it("moves a Lead optimistically on a status-changing Quick Action, then confirms with server truth", async () => {
    const lead = makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", status: "qualified" });
    vi.mocked(dataLayer.getLeads).mockResolvedValue([lead]);
    vi.mocked(dataLayer.updateLeadStatus).mockResolvedValue({
      success: true,
      data: { ...lead, status: "proposal_sent" },
    });
    const desktop = renderBoard();
    await screen.findByText("Priya Nair");

    await userEvent.click(desktop().getByRole("button", { name: /item actions/i }));
    await userEvent.click(desktop().getByRole("menuitem", { name: "Send Proposal" }));

    await waitFor(() => {
      expect(dataLayer.updateLeadStatus).toHaveBeenCalledWith("l1", "proposal_sent");
    });
    await waitFor(() => {
      expect(desktop().getByText("Proposal Sent", { selector: "span" })).toBeInTheDocument();
    });
  });

  it("rolls back the optimistic move and shows an error when the status update fails", async () => {
    const lead = makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", status: "qualified" });
    vi.mocked(dataLayer.getLeads).mockResolvedValue([lead]);
    vi.mocked(dataLayer.updateLeadStatus).mockResolvedValue({ success: false, error: "Update rejected." });
    const desktop = renderBoard();
    await screen.findByText("Priya Nair");

    await userEvent.click(desktop().getByRole("button", { name: /item actions/i }));
    await userEvent.click(desktop().getByRole("menuitem", { name: "Send Proposal" }));

    expect(await screen.findByText("Update rejected.")).toBeInTheDocument();
    // Rolled back to its original column badge.
    expect(desktop().getByText("Qualified", { selector: "span" })).toBeInTheDocument();
  });

  it("books a Lead successfully and removes it from the board", async () => {
    const lead = makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", status: "qualified" });
    vi.mocked(dataLayer.getLeads).mockResolvedValue([lead]);
    vi.mocked(dataLayer.bookLead).mockResolvedValue({
      success: true,
      data: {
        lead: { ...lead, status: "converted" },
        client: makeClient({ id: "client_1" }),
        event: { id: "event_1" } as never,
      },
    });
    const desktop = renderBoard();
    await screen.findByText("Priya Nair");

    await userEvent.click(desktop().getByRole("button", { name: /item actions/i }));
    await userEvent.click(desktop().getByRole("menuitem", { name: "Book Lead" }));

    await userEvent.selectOptions(await screen.findByLabelText(/event type/i), "proposal");
    await userEvent.click(screen.getByRole("button", { name: /^book lead$/i }));

    expect(await screen.findByText(/client and event created/i)).toBeInTheDocument();
    // The board is empty now — the Lead is gone, not just hidden.
    expect(screen.queryByText("Priya Nair")).not.toBeInTheDocument();
    expect(await screen.findByText(/no leads in the commercial pipeline/i)).toBeInTheDocument();
    expect(dataLayer.bookLead).toHaveBeenCalledWith("l1", expect.objectContaining({ event_type: "proposal" }));
  });

  it("shows a persistent recoverable alert (not a plain error) when booking leaves a pending recovery", async () => {
    const lead = makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", status: "qualified" });
    const client = makeClient({
      id: "client_1",
      first_name: "Priya",
      last_name: "Nair",
      originating_lead_id: "l1",
      pending_recovery: {
        version: 1,
        workflow: "booking",
        status: "pending",
        reason: "Creating the Event failed.",
        payload: {},
        attempts: 1,
        first_attempt_at: "2026-01-01T00:00:00.000Z",
        last_attempt_at: "2026-01-01T00:00:00.000Z",
      },
    });
    vi.mocked(dataLayer.getLeads).mockResolvedValue([lead]);
    vi.mocked(dataLayer.bookLead).mockResolvedValue({ success: false, error: "Booking failed." });
    vi.mocked(dataLayer.getClientsWithPendingRecovery).mockResolvedValue([client]);
    const desktop = renderBoard();
    await screen.findByText("Priya Nair");

    await userEvent.click(desktop().getByRole("button", { name: /item actions/i }));
    await userEvent.click(desktop().getByRole("menuitem", { name: "Book Lead" }));

    await userEvent.selectOptions(await screen.findByLabelText(/event type/i), "proposal");
    await userEvent.click(screen.getByRole("button", { name: /^book lead$/i }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/booking incomplete for priya nair/i)).toBeInTheDocument();
    // The board is empty now — the Lead really did convert, it's not lingering as a broken card.
    expect(screen.queryByText("Priya Nair", { selector: "p" })).not.toBeInTheDocument();
  });
});
