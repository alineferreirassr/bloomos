import type { ChecklistItem } from "@/types/checklistItem";
import type { ClientPortalChecklistItem } from "@/types/clientPortalChecklist";
import { readChecklistItems, writeChecklistItems } from "@/lib/data/mock/checklistStore";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { mockClientAccessRepository } from "@/lib/data/clientAccess/mockRepository";
import { NotFoundError } from "@/core/errors";
import { nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";

/**
 * Checkpoint 14, Step 7 — the client-facing Checklist. Mock-only,
 * unconditionally, regardless of `NEXT_PUBLIC_DATA_MODE` — the same
 * "new checkpoint domain, mock-only this phase" precedent
 * `clientDocumentApprovalStore.ts`/`clientPortalActivityStore.ts` already
 * establish, here for a stronger reason too: `client_visible`/
 * `client_comment` are new columns on the *real*, already-dual-mode
 * `checklist_items` table (see the Step 7 migration in
 * `supabase/migrations/`), which this session has no credentials to push
 * to the live project — so reading/writing them against the real Supabase
 * table would fail outright until that migration ships. Complete/Comment
 * reuse the exact same `ChecklistItem` record and its own `status`/
 * `client_comment` fields internal staff already see — never a
 * duplicated storage model, just gated to `client_visible === true` rows
 * and restricted to the one client account that "owns" a checklist
 * item's own Event via `client_id`.
 */

function toClientPortalChecklistItem(item: ChecklistItem): ClientPortalChecklistItem {
  return {
    id: item.id,
    event_id: item.owner_id,
    title: item.title,
    description: item.description,
    status: item.status,
    due_date: item.due_date,
    completed_at: item.completed_at,
    client_comment: item.client_comment ?? null,
  };
}

async function currentClientEventIds(): Promise<Set<string>> {
  const account = await mockClientAccessRepository.getCurrentClientAccount();
  if (!account) throw new NotFoundError("No active client account.");
  return new Set(readEvents().filter((event) => event.client_id === account.client_id).map((event) => event.id));
}

export async function getClientPortalChecklist(): Promise<ClientPortalChecklistItem[]> {
  const eventIds = await currentClientEventIds();
  return readChecklistItems()
    .filter((item) => item.owner_type === "event" && eventIds.has(item.owner_id) && item.client_visible === true)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toClientPortalChecklistItem);
}

/** Checkpoint 16, Step 9 — the Public API's own entry point, for an explicit `clientAccountId` rather than the "current session" account `currentClientEventIds()` resolves. Rejects an account from a different Workspace as not-found, the same "existence never leaks across a boundary" precedent `getClientPortalTimelineForAccount` follows. */
export async function getClientPortalChecklistForAccount(workspaceId: string, clientAccountId: string): Promise<ClientPortalChecklistItem[]> {
  const account = await mockClientAccessRepository.getClientAccountById(clientAccountId);
  if (account.workspace_id !== workspaceId) throw new NotFoundError(`Client account ${clientAccountId} was not found`);
  const eventIds = new Set(readEvents().filter((event) => event.client_id === account.client_id).map((event) => event.id));
  return readChecklistItems()
    .filter((item) => item.owner_type === "event" && eventIds.has(item.owner_id) && item.client_visible === true)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(toClientPortalChecklistItem);
}

async function requireOwnClientVisibleItem(id: string): Promise<ChecklistItem> {
  const eventIds = await currentClientEventIds();
  const item = readChecklistItems().find((candidate) => candidate.id === id);
  if (!item || item.owner_type !== "event" || !eventIds.has(item.owner_id) || item.client_visible !== true) {
    throw new NotFoundError(`Checklist item ${id} was not found`);
  }
  return item;
}

export async function completeClientPortalChecklistItem(id: string): Promise<DataResult<ClientPortalChecklistItem>> {
  const item = await requireOwnClientVisibleItem(id);
  if (item.status === "completed") return ok(toClientPortalChecklistItem(item));

  const now = nowIso();
  const updated: ChecklistItem = { ...item, status: "completed", completed_at: now, updated_at: now };
  writeChecklistItems(readChecklistItems().map((candidate) => (candidate.id === id ? updated : candidate)));
  return ok(toClientPortalChecklistItem(updated));
}

export async function commentOnClientPortalChecklistItem(id: string, comment: string): Promise<DataResult<ClientPortalChecklistItem>> {
  const trimmed = comment.trim();
  if (trimmed.length === 0) return fail("Please fix the highlighted fields.", { comment: "A comment can't be empty" });

  const item = await requireOwnClientVisibleItem(id);
  const updated: ChecklistItem = { ...item, client_comment: trimmed, updated_at: nowIso() };
  writeChecklistItems(readChecklistItems().map((candidate) => (candidate.id === id ? updated : candidate)));
  return ok(toClientPortalChecklistItem(updated));
}
