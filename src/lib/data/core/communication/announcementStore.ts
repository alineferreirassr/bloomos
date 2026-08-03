import type { Announcement, AnnouncementPriority, AnnouncementAudience } from "@/types/communication";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

/** v2.0 Checkpoint 24, Step 8 — Announcement Engine's own persistence. */
let announcements: Announcement[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetAnnouncementStore(): void {
  announcements = [];
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  priority?: AnnouncementPriority;
  audience?: AnnouncementAudience;
  publishAt?: string;
  expiresAt?: string | null;
  requiresAcknowledgement?: boolean;
}

/** Every announcement currently live for `now` — published, not yet expired. Scheduling/expiration are evaluated on read, never a background job (no scheduled-jobs infra exists in this codebase, same non-goal precedent as the Automation Engine). */
async function listActiveAnnouncements(workspaceId: string, now: Date = new Date()): Promise<Announcement[]> {
  await delay(100);
  const nowIsoStr = now.toISOString();
  return announcements
    .filter((a) => a.workspace_id === workspaceId && a.publish_at <= nowIsoStr && (a.expires_at === null || a.expires_at > nowIsoStr))
    .sort((a, b) => b.publish_at.localeCompare(a.publish_at));
}

async function listAllAnnouncements(workspaceId: string): Promise<Announcement[]> {
  await delay(100);
  return announcements.filter((a) => a.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function createAnnouncement(workspaceId: string, authorMemberId: string, authorName: string, input: CreateAnnouncementInput): Promise<DataResult<Announcement>> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length === 0 || body.length === 0) {
    return fail("Please fix the highlighted fields.", { title: title.length === 0 ? "Title is required" : "", body: body.length === 0 ? "Body is required" : "" });
  }
  const announcement: Announcement = {
    id: generateId("announcement"),
    workspace_id: workspaceId,
    author_member_id: authorMemberId,
    author_name: authorName,
    title,
    body,
    priority: input.priority ?? "normal",
    audience: input.audience ?? "everyone",
    publish_at: input.publishAt ?? nowIso(),
    expires_at: input.expiresAt ?? null,
    requires_acknowledgement: input.requiresAcknowledgement ?? false,
    acknowledged_member_ids: [],
    created_at: nowIso(),
  };
  announcements = [...announcements, announcement];
  return ok(announcement);
}

async function acknowledgeAnnouncement(id: string, memberId: string): Promise<DataResult<Announcement>> {
  const existing = announcements.find((a) => a.id === id);
  if (!existing) return fail("Announcement not found.");
  if (existing.acknowledged_member_ids.includes(memberId)) return ok(existing);
  const updated: Announcement = { ...existing, acknowledged_member_ids: [...existing.acknowledged_member_ids, memberId] };
  announcements = announcements.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

async function deleteAnnouncement(id: string): Promise<DataResult<Announcement>> {
  const existing = announcements.find((a) => a.id === id);
  if (!existing) return fail("Announcement not found.");
  announcements = announcements.filter((a) => a.id !== id);
  return ok(existing);
}

export const mockAnnouncementRepository = {
  listActiveAnnouncements,
  listAllAnnouncements,
  createAnnouncement,
  acknowledgeAnnouncement,
  deleteAnnouncement,
};
