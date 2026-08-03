import type { Note } from "@/types/note";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const SEED_NOTES: Note[] = [
  {
    id: "note_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    title: "Shellfish allergy",
    content:
      "Sofia mentioned a severe shellfish allergy during the consultation call — keep any catering suggestions clear of it.",
    category: "allergy",
    priority: "critical",
    is_pinned: true,
    attachments: [],
    created_by: "Aline Ferreira",
    created_at: "2026-06-05T15:00:00.000Z",
    updated_at: "2026-06-05T15:00:00.000Z",
  },
  {
    id: "note_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    title: "Prefers string quartet",
    content: "Would like live string music rather than a DJ or playlist.",
    category: "preference",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "Aline Ferreira",
    created_at: "2026-06-10T10:30:00.000Z",
    updated_at: "2026-06-10T10:30:00.000Z",
  },
  {
    id: "note_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_3",
    title: "Drone footage idea",
    content:
      "Could be a strong add-on given the beach setting — bring up during proposal review.",
    category: "idea",
    priority: "low",
    is_pinned: false,
    attachments: [],
    created_by: "Aline Ferreira",
    created_at: "2026-06-01T09:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "client_note_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_1",
    title: "Tree nut allergy",
    content:
      "Naomi has a tree nut allergy — confirm with caterers for any anniversary events.",
    category: "allergy",
    priority: "critical",
    is_pinned: true,
    attachments: [],
    created_by: "Aline Ferreira",
    created_at: "2022-01-12T11:00:00.000Z",
    updated_at: "2022-01-12T11:00:00.000Z",
  },
  {
    id: "client_note_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_1",
    title: "James plans surprises",
    content:
      "James likes to plan small surprises for anniversaries — keep his outreach separate and confidential from Naomi's.",
    category: "relationship_detail",
    priority: "high",
    is_pinned: false,
    attachments: [],
    created_by: "Aline Ferreira",
    created_at: "2022-03-01T09:00:00.000Z",
    updated_at: "2022-03-01T09:00:00.000Z",
  },
  {
    id: "event_note_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    title: "Sam's ring size confirmed",
    content: "Jordan confirmed Sam's ring size is 6.5 — passed along to the jeweler contact.",
    category: "special_request",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "Amoré Bloom Team",
    created_at: "2026-06-10T09:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z",
  },
  {
    id: "event_note_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_2",
    title: "Nut allergy — Casey",
    content: "Casey has a mild nut allergy — confirm every food item, including packaging, is nut-free.",
    category: "allergy",
    priority: "high",
    is_pinned: true,
    attachments: [],
    created_by: "Amoré Bloom Team",
    created_at: "2026-06-12T09:15:00.000Z",
    updated_at: "2026-06-12T09:15:00.000Z",
  },
  {
    id: "event_note_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_3",
    title: "Keep confidential from Naomi",
    content: "James is planning this for Naomi — do not mention it in any communication she might see.",
    category: "relationship_detail",
    priority: "high",
    is_pinned: true,
    attachments: [],
    created_by: "Amoré Bloom Team",
    created_at: "2026-06-20T11:15:00.000Z",
    updated_at: "2026-06-20T11:15:00.000Z",
  },
  {
    id: "event_note_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_4",
    title: "Client feedback",
    content: '"Absolutely perfect, exceeded expectations" — Naomi, via thank-you text after the event.',
    category: "general",
    priority: "normal",
    is_pinned: false,
    attachments: [],
    created_by: "Amoré Bloom Team",
    created_at: "2026-06-19T09:00:00.000Z",
    updated_at: "2026-06-19T09:00:00.000Z",
  },
];

let notes: Note[] = SEED_NOTES.map((note) => ({ ...note }));

export function readNotes(): Note[] {
  return notes;
}

export function writeNotes(next: Note[]): void {
  notes = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetNotesStore(): void {
  notes = SEED_NOTES.map((note) => ({ ...note }));
}
