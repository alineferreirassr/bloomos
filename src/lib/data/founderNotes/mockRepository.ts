import type { NoteToFounder } from "@/types/founderNote";
import type { FounderNoteRepository } from "@/lib/data/founderNotes/repository";
import { ok, fail } from "@/lib/data/result";
import { readFounderNotes, createMockFounderNote, resetFounderNotesMockData } from "@/lib/data/mock/founderNotesStore";
import { getCurrentWorkspaceMember } from "@/lib/data";

export { resetFounderNotesMockData };

async function currentMemberUserId(): Promise<string> {
  const member = await getCurrentWorkspaceMember();
  if (!member) throw new Error("No current workspace member in mock mode.");
  return member.user_id;
}

export const mockFounderNoteRepository: FounderNoteRepository = {
  async getMyNotes() {
    const memberId = await currentMemberUserId();
    return readFounderNotes().filter((n) => n.author_id === memberId);
  },

  async createNote(body) {
    const trimmed = body.trim();
    if (trimmed.length === 0) return fail("Write something before sending.");
    const memberId = await currentMemberUserId();
    return ok<NoteToFounder>(createMockFounderNote(memberId, trimmed));
  },
};
