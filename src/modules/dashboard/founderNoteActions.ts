"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getMyFounderNotes, createFounderNote } from "@/lib/data";
import type { NoteToFounder } from "@/types/founderNote";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "This isn't available right now.";

async function requireActiveSession(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { ok: false, error: GENERIC_ACCESS_ERROR };
  return { ok: true };
}

async function serverContextIfSupabase() {
  return getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;
}

/** Only the caller's own authored notes — never another employee's, never a workspace-wide inbox. */
export async function getMyFounderNotesAction(): Promise<NoteToFounder[]> {
  const gate = await requireActiveSession();
  if (!gate.ok) return [];
  return getMyFounderNotes(await serverContextIfSupabase());
}

/** `body` is free text the employee writes themselves — nothing here reads or attaches mood/water data. */
export async function createFounderNoteAction(body: string): Promise<DataResult<NoteToFounder>> {
  const gate = await requireActiveSession();
  if (!gate.ok) return fail(gate.error);
  return createFounderNote(body, await serverContextIfSupabase());
}
