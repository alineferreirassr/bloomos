import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommercialPipelineCard } from "@/modules/pipeline/components/CommercialPipelineCard";
import { makeLead } from "@/modules/leads/testUtils";

describe("CommercialPipelineCard — SOCIAL-13F Instagram Lead visibility", () => {
  it("shows an Instagram badge and the real Instagram handle as the card title for an Instagram-originated Lead with no name", () => {
    const instagramLead = makeLead({ id: "lead_ig", first_name: null, last_name: null, email: null, instagram: "@curious_bride", instagram_external_id: "17841400000000001", source: "Instagram", assigned_to: null });

    render(<CommercialPipelineCard lead={instagramLead} actions={[]} draggable={false} />);

    expect(screen.getByText("@curious_bride")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("never shows the Instagram badge for a manually-created, non-Instagram Lead", () => {
    const manualLead = makeLead({ id: "lead_manual", first_name: "Priya", last_name: "Nair", source: "Website" });

    render(<CommercialPipelineCard lead={manualLead} actions={[]} draggable={false} />);

    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument();
  });

  it("shows 'Assigned to <name>' once an Instagram Lead has been assigned", () => {
    const instagramLead = makeLead({ id: "lead_ig", first_name: null, last_name: null, instagram: "@curious_bride", source: "Instagram", assigned_to: "Aline Ferreira" });

    render(<CommercialPipelineCard lead={instagramLead} actions={[]} draggable={false} />);

    expect(screen.getByText(/assigned to aline ferreira/i)).toBeInTheDocument();
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });

  it("falls back to a stable generic label when neither a name nor an Instagram handle is available", () => {
    const bareLead = makeLead({ id: "lead_bare", first_name: null, last_name: null, instagram: null, source: "Instagram" });

    render(<CommercialPipelineCard lead={bareLead} actions={[]} draggable={false} />);

    expect(screen.getByText("New Lead")).toBeInTheDocument();
  });
});
