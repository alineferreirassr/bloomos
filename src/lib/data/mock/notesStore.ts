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
