import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadListTable } from "@/modules/leads/components/LeadListTable";
import { LeadListCards } from "@/modules/leads/components/LeadListCards";
import { makeLead } from "@/modules/leads/testUtils";

const leads = [
  makeLead({ id: "lead_a", first_name: "Sofia", last_name: "Marchetti", status: "qualified" }),
  makeLead({ id: "lead_b", first_name: "Daniel", last_name: "Reyes", status: "new" }),
];

describe("LeadListTable (desktop)", () => {
  it("renders every lead's name and status", () => {
    render(<LeadListTable leads={leads} />);
    expect(screen.getByText("Sofia Marchetti")).toBeInTheDocument();
    expect(screen.getByText("Daniel Reyes")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("SOCIAL-13F — an Instagram-originated Lead with no name renders correctly, using its Instagram handle instead of a blank name, and its Source column still reads Instagram", () => {
    const instagramLead = makeLead({ id: "lead_ig", first_name: null, last_name: null, email: null, instagram: "@curious_bride", instagram_external_id: "17841400000000001", source: "Instagram" });
    render(<LeadListTable leads={[instagramLead]} />);

    expect(screen.getByText("@curious_bride")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });
});

describe("LeadListCards (mobile)", () => {
  it("renders every lead's name and status", () => {
    render(<LeadListCards leads={leads} />);
    expect(screen.getByText("Sofia Marchetti")).toBeInTheDocument();
    expect(screen.getByText("Daniel Reyes")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("SOCIAL-13F — an Instagram-originated Lead with no name renders correctly, using its Instagram handle instead of a blank name", () => {
    const instagramLead = makeLead({ id: "lead_ig", first_name: null, last_name: null, email: null, instagram: "@curious_bride", instagram_external_id: "17841400000000001", source: "Instagram" });
    render(<LeadListCards leads={[instagramLead]} />);

    expect(screen.getByText("@curious_bride")).toBeInTheDocument();
  });
});
