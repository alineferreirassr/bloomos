import type { LeadNote } from "@/types/note";

const SEED_NOTES: LeadNote[] = [
  {
    id: "note_1",
    lead_id: "lead_1",
    title: "Shellfish allergy",
    content:
      "Sofia mentioned a severe shellfish allergy during the consultation call — keep any catering suggestions clear of it.",
    category: "allergy",
    priority: "critical",
    is_pinned: true,
    created_by: "Aline Ferreira",
    created_at: "2026-06-05T15:00:00.000Z",
    updated_at: "2026-06-05T15:00:00.000Z",
  },
  {
    id: "note_2",
    lead_id: "lead_1",
    title: "Prefers string quartet",
    content: "Would like live string music rather than a DJ or playlist.",
    category: "preference",
    priority: "normal",
    is_pinned: false,
    created_by: "Aline Ferreira",
    created_at: "2026-06-10T10:30:00.000Z",
    updated_at: "2026-06-10T10:30:00.000Z",
  },
  {
    id: "note_3",
    lead_id: "lead_3",
    title: "Drone footage idea",
    content:
      "Could be a strong add-on given the beach setting — bring up during proposal review.",
    category: "idea",
    priority: "low",
    is_pinned: false,
    created_by: "Aline Ferreira",
    created_at: "2026-06-01T09:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
  },
];

let notes: LeadNote[] = SEED_NOTES.map((note) => ({ ...note }));

export function readNotes(): LeadNote[] {
  return notes;
}

export function writeNotes(next: LeadNote[]): void {
  notes = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetNotesStore(): void {
  notes = SEED_NOTES.map((note) => ({ ...note }));
}
