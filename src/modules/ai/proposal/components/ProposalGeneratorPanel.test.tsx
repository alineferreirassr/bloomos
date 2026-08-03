import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalGeneratorPanel } from "@/modules/ai/proposal/components/ProposalGeneratorPanel";
import { getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
import { PROPOSAL_SKILL_ID } from "@/modules/ai/proposal/registerProposalSkill";
import type { ProposalDraft } from "@/types/proposal";
import type { GetLatestProposalResult } from "@/modules/ai/proposal/getLatestProposalForEvent";
import type { GenerateProposalDraftResult } from "@/modules/ai/proposal/generateProposalDraft";
import type { ReviewProposalDraftResult } from "@/modules/ai/proposal/acceptProposalDraft";

vi.mock("@/modules/ai/proposal/generateProposalDraft", () => ({ generateProposalDraft: vi.fn() }));
vi.mock("@/modules/ai/proposal/acceptProposalDraft", () => ({ acceptProposalDraft: vi.fn() }));
vi.mock("@/modules/ai/proposal/rejectProposalDraft", () => ({ rejectProposalDraft: vi.fn() }));
vi.mock("@/modules/ai/proposal/getLatestProposalForEvent", () => ({ getLatestProposalForEvent: vi.fn() }));

import { generateProposalDraft } from "@/modules/ai/proposal/generateProposalDraft";
import { acceptProposalDraft } from "@/modules/ai/proposal/acceptProposalDraft";
import { rejectProposalDraft } from "@/modules/ai/proposal/rejectProposalDraft";
import { getLatestProposalForEvent } from "@/modules/ai/proposal/getLatestProposalForEvent";

function makeDraft(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    id: "proposal_1",
    workspace_id: "ws_1",
    event_id: "event_1",
    client_id: "client_1",
    status: "draft",
    version: 1,
    parent_proposal_id: null,
    executive_summary: "A proposal for Jamie's beachfront event.",
    event_overview: "Beachfront proposal overview.",
    services_included: [{ event_service_id: "es_1", label: "Photography", description: null, price_minor: 50000, currency: "USD", is_optional_add_on: false }],
    timeline_summary: "No schedule yet.",
    pricing_summary: { subtotal_minor: 50000, currency: "USD" },
    payment_terms: [{ label: "Full balance", amount_minor: 50000, due_date: null, description: null }],
    recommendations: ["Confirm the guest count."],
    optional_add_ons: [],
    questions_for_client: ["What is your target budget?"],
    ai_confidence: 80,
    missing_information: ["Budget range"],
    provider: "mock",
    model: "bloomos-mock-proposal-v1",
    prompt_version: "proposal-generator-v1",
    mock: true,
    generation_latency_ms: 42,
    generated_at: "2026-07-25T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-07-25T00:00:00.000Z",
    updated_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetSkillRunnerRegistry();
});

describe("ProposalGeneratorPanel", () => {
  it("shows an idle prompt before any generation when no prior draft exists", async () => {
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: null } satisfies GetLatestProposalResult);
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByText(/no proposal has been drafted yet/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /generate draft/i })).toBeInTheDocument();
  });

  it("loads and renders the existing latest draft on mount", async () => {
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: makeDraft() } satisfies GetLatestProposalResult);
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByText(/a proposal for jamie's beachfront event/i)).toBeInTheDocument());
    expect(screen.getByText(/development mock/i)).toBeInTheDocument();
    expect(screen.getByText("Draft v1")).toBeInTheDocument();
  });

  it("generates a new draft on click and renders it", async () => {
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: null } satisfies GetLatestProposalResult);
    vi.mocked(generateProposalDraft).mockResolvedValue({ success: true, data: makeDraft(), relevantMemories: [] } satisfies GenerateProposalDraftResult);
    const user = userEvent.setup();
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /generate draft/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByText(/a proposal for jamie's beachfront event/i)).toBeInTheDocument());
    expect(generateProposalDraft).toHaveBeenCalledWith("event_1", null);
  });

  it("shows an alert with retry on generation failure", async () => {
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: null } satisfies GetLatestProposalResult);
    vi.mocked(generateProposalDraft).mockResolvedValue({ success: false, error: "This proposal isn't available." } satisfies GenerateProposalDraftResult);
    const user = userEvent.setup();
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /generate draft/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /generate draft/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("regenerates against the current draft's id, continuing the version chain", async () => {
    const existing = makeDraft();
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: existing } satisfies GetLatestProposalResult);
    vi.mocked(generateProposalDraft).mockResolvedValue({ success: true, data: makeDraft({ version: 2, parent_proposal_id: existing.id }), relevantMemories: [] } satisfies GenerateProposalDraftResult);
    const user = userEvent.setup();
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /regenerate/i }));
    expect(generateProposalDraft).toHaveBeenCalledWith("event_1", existing.id);
    await waitFor(() => expect(screen.getByText("Draft v2")).toBeInTheDocument());
  });

  it("accepts a draft and reflects the accepted status", async () => {
    const existing = makeDraft();
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: existing } satisfies GetLatestProposalResult);
    vi.mocked(acceptProposalDraft).mockResolvedValue({ success: true, data: { ...existing, status: "accepted" } } satisfies ReviewProposalDraftResult);
    const user = userEvent.setup();
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /accept draft/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /accept draft/i }));
    await waitFor(() => expect(screen.getByText("Accepted")).toBeInTheDocument());
    expect(acceptProposalDraft).toHaveBeenCalledWith(existing.id);
  });

  it("rejects a draft and reflects the rejected status", async () => {
    const existing = makeDraft();
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: existing } satisfies GetLatestProposalResult);
    vi.mocked(rejectProposalDraft).mockResolvedValue({ success: true, data: { ...existing, status: "rejected" } } satisfies ReviewProposalDraftResult);
    const user = userEvent.setup();
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /reject draft/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /reject draft/i }));
    await waitFor(() => expect(screen.getByText("Rejected")).toBeInTheDocument());
  });

  it("does not show Accept/Reject once a draft is accepted", async () => {
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: makeDraft({ status: "accepted" }) } satisfies GetLatestProposalResult);
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByText("Accepted")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /accept draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject draft/i })).not.toBeInTheDocument();
  });

  it("copies the proposal to the clipboard", async () => {
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: makeDraft() } satisfies GetLatestProposalResult);
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /copy proposal as text/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /copy proposal as text/i }));
    expect(writeTextSpy).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument());
  });

  it("toggles the missing-information disclosure", async () => {
    vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: makeDraft() } satisfies GetLatestProposalResult);
    const user = userEvent.setup();
    render(<ProposalGeneratorPanel eventId="event_1" />);
    await waitFor(() => expect(screen.getByText(/view missing information/i)).toBeInTheDocument());

    expect(screen.queryByText("Budget range")).not.toBeInTheDocument();
    await user.click(screen.getByText(/view missing information/i));
    expect(screen.getByText("Budget range")).toBeInTheDocument();
  });

  describe("Bloom AI Skill runner integration", () => {
    it("registers itself as the Proposal Generator Skill's runner while mounted", async () => {
      vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: null } satisfies GetLatestProposalResult);
      const { unmount } = render(<ProposalGeneratorPanel eventId="event_1" />);
      await waitFor(() => expect(getSkillRunner(PROPOSAL_SKILL_ID)).toBeDefined());
      unmount();
    });

    it("unregisters its runner on unmount", async () => {
      vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: null } satisfies GetLatestProposalResult);
      const { unmount } = render(<ProposalGeneratorPanel eventId="event_1" />);
      await waitFor(() => expect(getSkillRunner(PROPOSAL_SKILL_ID)).toBeDefined());
      unmount();
      expect(getSkillRunner(PROPOSAL_SKILL_ID)).toBeUndefined();
    });

    it("running the Skill Picker's Proposal Generator card generates a draft, same as clicking the button", async () => {
      vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: null } satisfies GetLatestProposalResult);
      vi.mocked(generateProposalDraft).mockResolvedValue({ success: true, data: makeDraft(), relevantMemories: [] } satisfies GenerateProposalDraftResult);
      render(<ProposalGeneratorPanel eventId="event_1" />);
      await waitFor(() => expect(getSkillRunner(PROPOSAL_SKILL_ID)).toBeDefined());

      await getSkillRunner(PROPOSAL_SKILL_ID)?.();
      await waitFor(() => expect(screen.getByText(/a proposal for jamie's beachfront event/i)).toBeInTheDocument());
      expect(generateProposalDraft).toHaveBeenCalledWith("event_1", null);
    });

    it("running the Skill runner regenerates against the current draft's id", async () => {
      const existing = makeDraft();
      vi.mocked(getLatestProposalForEvent).mockResolvedValue({ success: true, data: existing } satisfies GetLatestProposalResult);
      vi.mocked(generateProposalDraft).mockResolvedValue({ success: true, data: makeDraft({ version: 2, parent_proposal_id: existing.id }), relevantMemories: [] } satisfies GenerateProposalDraftResult);
      render(<ProposalGeneratorPanel eventId="event_1" />);
      await waitFor(() => expect(screen.getByText("Draft v1")).toBeInTheDocument());

      await getSkillRunner(PROPOSAL_SKILL_ID)?.();
      expect(generateProposalDraft).toHaveBeenCalledWith("event_1", existing.id);
    });
  });
});
