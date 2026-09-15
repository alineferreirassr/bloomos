import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadDetailView } from "@/modules/leads/components/LeadDetailView";
import { makeLead } from "@/modules/leads/testUtils";

vi.mock("@/lib/data", () => ({
  getLeadById: vi.fn(),
  getNotesByLeadId: vi.fn().mockResolvedValue([]),
  getTimelineByLeadId: vi.fn().mockResolvedValue([]),
  createNote: vi.fn(),
  togglePinNote: vi.fn(),
}));
// Stubbed out — none of these are relevant to the banner this checkpoint
// adds, and several have their own data-fetching/session dependencies this
// test deliberately isolates away from.
vi.mock("@/modules/leads/components/LeadActions", () => ({ LeadActions: () => null }));
vi.mock("@/modules/leads/components/LeadStatusSelect", () => ({ LeadStatusSelect: () => null }));
vi.mock("@/modules/notes/components/NotesSection", () => ({ NotesSection: () => null }));
vi.mock("@/modules/timeline/components/Timeline", () => ({ Timeline: () => null }));
vi.mock("@/modules/clientJourney/components/LeadJourneySummaryCard", () => ({ LeadJourneySummaryCard: () => null }));

import { getLeadById } from "@/lib/data";

const BANNER_TEXT = "This Lead needs a name and email before it can be converted to a Client.";

describe("LeadDetailView — SOCIAL-13E conversion-readiness indication", () => {
  it("shows the indication for a Lead missing a name and email (an Instagram-originated Lead)", async () => {
    const lead = makeLead({ id: "l1", first_name: null, last_name: null, email: null, instagram: "@curious_bride", instagram_external_id: "17841400000000001", source: "Instagram" });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l1" />);

    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it("shows the indication for a Lead missing only the email", async () => {
    const lead = makeLead({ id: "l2", first_name: "Priya", last_name: "Nair", email: null });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l2" />);

    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it("never shows the indication for a fully-complete Lead", async () => {
    const lead = makeLead({ id: "l3", first_name: "Priya", last_name: "Nair", email: "priya@example.com" });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l3" />);

    await screen.findByText("Priya Nair");
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it("never shows the indication for a converted Lead — it already shows the distinct read-only banner instead", async () => {
    const lead = makeLead({ id: "l4", first_name: null, last_name: null, email: null, status: "converted", converted_client_id: "client_1" });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l4" />);

    await screen.findByText(/converted to a client and is read-only/i);
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });
});

describe("LeadDetailView — SOCIAL-13F operational state visibility", () => {
  it("shows an Instagram badge in the header and the Instagram handle as the display name for an Instagram-originated Lead", async () => {
    const lead = makeLead({ id: "l5", first_name: null, last_name: null, email: null, instagram: "@curious_bride", instagram_external_id: "17841400000000001", source: "Instagram" });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l5" />);

    expect(await screen.findByRole("heading", { name: "@curious_bride" })).toBeInTheDocument();
    // Scoped to the badge's own <span> specifically — "Instagram" also
    // legitimately appears elsewhere on this page (the "Instagram" contact
    // field label, and the Source field's own value), so a bare text query
    // would false-positive regardless of whether the badge itself renders.
    expect(screen.getByText("Instagram", { selector: "span" })).toBeInTheDocument();
  });

  it("never shows the Instagram badge for a manually-created, non-Instagram Lead", async () => {
    const lead = makeLead({ id: "l6", first_name: "Priya", last_name: "Nair", source: "Website" });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l6" />);

    expect(await screen.findByRole("heading", { name: "Priya Nair" })).toBeInTheDocument();
    expect(screen.queryByText("Instagram", { selector: "span" })).not.toBeInTheDocument();
  });

  it("shows a clear 'Unassigned' label (not a bare dash) for a Lead with no assigned_to", async () => {
    const lead = makeLead({ id: "l7", first_name: "Priya", last_name: "Nair", assigned_to: null });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l7" />);

    expect(await screen.findByText("Unassigned")).toBeInTheDocument();
  });

  it("shows the real assignee name once a Lead has been assigned", async () => {
    const lead = makeLead({ id: "l8", first_name: "Priya", last_name: "Nair", assigned_to: "Aline Ferreira" });
    vi.mocked(getLeadById).mockResolvedValue(lead);

    render(<LeadDetailView leadId="l8" />);

    expect(await screen.findByText("Aline Ferreira")).toBeInTheDocument();
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });
});
