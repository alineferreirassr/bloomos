import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({
  fetchEventContextRecord: vi.fn(),
}));
vi.mock("@/lib/data/mock/contractsStore", () => ({
  readContracts: vi.fn(),
}));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({
  getNotesByOwner: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { proposalDetailsContextBuilder, type ProposalDetailsContextData } from "@/modules/ai/contextBuilders/proposalDetailsContextBuilder";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { readContracts } from "@/lib/data/mock/contractsStore";
import { getNotesByOwner } from "@/lib/data/mock/notesTimelineShared";
import type { Contract } from "@/types/contract";
import type { Note } from "@/types/note";

function getData(result: { data: unknown } | null): ProposalDetailsContextData {
  return result?.data as ProposalDetailsContextData;
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract_1",
    workspace_id: "ws_1",
    client_id: "client_1",
    event_id: "event_1",
    template_id: null,
    contract_number: "C-0001",
    title: "Agreement",
    description: null,
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    effective_date: null,
    expiration_date: null,
    signed_at: null,
    sent_at: null,
    viewed_at: null,
    declined_at: null,
    cancelled_at: null,
    archived_at: null,
    total_value: 700,
    deposit_required: true,
    deposit_amount: 200,
    remaining_balance: 500,
    currency: "USD",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note_1",
    workspace_id: "ws_1",
    owner_type: "event",
    owner_id: "event_1",
    title: "Consultation",
    content: "Client wants a beach theme.",
    category: "general",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe("proposalDetailsContextBuilder", () => {
  it("returns null when no eventId ref is supplied", async () => {
    const result = await proposalDetailsContextBuilder.build({ workspaceId: "ws_1", refs: {} });
    expect(result).toBeNull();
  });

  it("returns null when the Event doesn't exist", async () => {
    vi.mocked(fetchEventContextRecord).mockResolvedValue(null);
    const result = await proposalDetailsContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "missing" } });
    expect(result).toBeNull();
  });

  it("returns null contractPaymentTerms when no Contract exists for this Event", async () => {
    vi.mocked(fetchEventContextRecord).mockResolvedValue({ event: makeEvent({ id: "event_1" }), client: null, checklist: [], schedule: [] });
    vi.mocked(readContracts).mockReturnValue([]);
    vi.mocked(getNotesByOwner).mockResolvedValue([]);

    const result = await proposalDetailsContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(getData(result).contractPaymentTerms).toBeNull();
  });

  it("surfaces an existing Contract's deposit/remaining balance", async () => {
    vi.mocked(fetchEventContextRecord).mockResolvedValue({ event: makeEvent({ id: "event_1" }), client: null, checklist: [], schedule: [] });
    vi.mocked(readContracts).mockReturnValue([makeContract()]);
    vi.mocked(getNotesByOwner).mockResolvedValue([]);

    const result = await proposalDetailsContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(getData(result).contractPaymentTerms).toEqual({ depositAmount: 200, remainingBalance: 500, currency: "USD" });
  });

  it("surfaces Event Notes as consultationNotes, capped at 8", async () => {
    vi.mocked(fetchEventContextRecord).mockResolvedValue({ event: makeEvent({ id: "event_1" }), client: null, checklist: [], schedule: [] });
    vi.mocked(readContracts).mockReturnValue([]);
    vi.mocked(getNotesByOwner).mockResolvedValue(Array.from({ length: 10 }, (_, index) => makeNote({ id: `note_${index}`, content: `Note ${index}` })));

    const result = await proposalDetailsContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(getData(result).consultationNotes).toHaveLength(8);
  });

  it("flags a surprise event as an important constraint", async () => {
    vi.mocked(fetchEventContextRecord).mockResolvedValue({ event: makeEvent({ id: "event_1", surprise_event: true }), client: null, checklist: [], schedule: [] });
    vi.mocked(readContracts).mockReturnValue([]);
    vi.mocked(getNotesByOwner).mockResolvedValue([]);

    const result = await proposalDetailsContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(getData(result).importantConstraints.some((constraint) => /surprise/i.test(constraint))).toBe(true);
  });

  it("names missing event date/location/budget in eventMissingInformation", async () => {
    vi.mocked(fetchEventContextRecord).mockResolvedValue({
      event: makeEvent({ id: "event_1", event_date: null, location_name: null, budget_min: null, budget_max: null }),
      client: null,
      checklist: [],
      schedule: [],
    });
    vi.mocked(readContracts).mockReturnValue([]);
    vi.mocked(getNotesByOwner).mockResolvedValue([]);

    const result = await proposalDetailsContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(getData(result).eventMissingInformation.sort()).toEqual(["Budget range", "Event date", "Location"].sort());
  });
});
