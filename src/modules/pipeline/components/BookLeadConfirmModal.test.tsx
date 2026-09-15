import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookLeadConfirmModal } from "@/modules/pipeline/components/BookLeadConfirmModal";
import { makeLead } from "@/modules/leads/testUtils";

vi.mock("@/lib/data", () => ({ bookLead: vi.fn(), getClientsWithPendingRecovery: vi.fn() }));

describe("BookLeadConfirmModal — SOCIAL-13E null-safe title/name", () => {
  it("uses the Lead's real full name for the default Event title and the confirmation copy when a name is present", () => {
    const lead = makeLead({ first_name: "Priya", last_name: "Nair" });

    render(<BookLeadConfirmModal lead={lead} open onClose={vi.fn()} onBooked={vi.fn()} onPendingRecovery={vi.fn()} />);

    expect(screen.getByLabelText(/event title/i)).toHaveValue("Priya Nair's Event");
    expect(screen.getByText("Priya Nair", { selector: "strong" })).toBeInTheDocument();
  });

  it("falls back to the Instagram handle — never the literal word \"null\" or a bare \"'s Event\" — when the Lead has no name", () => {
    const lead = makeLead({ first_name: null, last_name: null, instagram: "@curious_bride", instagram_external_id: "17841400000000001", source: "Instagram" });

    render(<BookLeadConfirmModal lead={lead} open onClose={vi.fn()} onBooked={vi.fn()} onPendingRecovery={vi.fn()} />);

    const titleInput = screen.getByLabelText(/event title/i);
    expect(titleInput).toHaveValue("@curious_bride's Event");
    expect((titleInput as HTMLInputElement).value).not.toContain("null");
    expect(screen.getByText("@curious_bride", { selector: "strong" })).toBeInTheDocument();
  });

  it("falls back to a stable generic label — never fabricates a name — when the Lead has neither a name nor an Instagram handle", () => {
    const lead = makeLead({ first_name: null, last_name: null, instagram: null, instagram_external_id: "17841400000000002", source: "Instagram" });

    render(<BookLeadConfirmModal lead={lead} open onClose={vi.fn()} onBooked={vi.fn()} onPendingRecovery={vi.fn()} />);

    const titleInput = screen.getByLabelText(/event title/i);
    expect(titleInput).toHaveValue("New Lead's Event");
    expect((titleInput as HTMLInputElement).value).not.toContain("null");
    expect(screen.getByText("New Lead", { selector: "strong" })).toBeInTheDocument();
  });

  it("a Lead with only a first name never renders a trailing/leading blank next to it", () => {
    const lead = makeLead({ first_name: "Priya", last_name: null });

    render(<BookLeadConfirmModal lead={lead} open onClose={vi.fn()} onBooked={vi.fn()} onPendingRecovery={vi.fn()} />);

    expect(screen.getByLabelText(/event title/i)).toHaveValue("Priya's Event");
  });
});
