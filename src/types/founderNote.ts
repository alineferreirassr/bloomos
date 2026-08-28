/**
 * A private employee -> Founder/Admin note ("Note for Aline"). Deliberately
 * NOT the generic `Note` type (`src/types/note.ts`) — that one's RLS is
 * workspace-wide (every active member can read it), the wrong visibility
 * model here. `notes_to_founder`'s own RLS grants read to the author or to
 * an owner/admin role only — see the migration for the exact policy.
 *
 * Never carries mood or water-tracker data — `body` is free text the
 * employee writes themselves; nothing in this shape or its write path
 * auto-attaches wellness information.
 */
export interface NoteToFounder {
  id: string;
  workspace_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
