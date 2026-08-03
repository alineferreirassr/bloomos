"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockAnnouncementRepository, type CreateAnnouncementInput } from "@/lib/data/core/communication/announcementStore";
import { getCoreNotificationsService } from "@/core/notifications";
import { buildNotificationInput } from "@/core/communication/notificationEngine";
import { getWorkspaceMembers } from "@/lib/data";
import type { Announcement } from "@/types/communication";
import type { DataResult } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "Announcements aren't available. You may not have access to them.";

export async function listActiveAnnouncementsAction(): Promise<DataResult<Announcement[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const announcements = await mockAnnouncementRepository.listActiveAnnouncements(session.workspace.id);
  return { success: true, data: announcements };
}

export async function listAllAnnouncementsAction(): Promise<DataResult<Announcement[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const announcements = await mockAnnouncementRepository.listAllAnnouncements(session.workspace.id);
  return { success: true, data: announcements };
}

/**
 * v2.0 Checkpoint 24, Step 8 — publishing an Announcement immediately fans
 * out one real, in-app Notification per matching Workspace member (never a
 * broadcast side channel — every recipient gets the exact same
 * `getCoreNotificationsService()` row every other notification kind uses).
 * A scheduled-future `publishAt` still creates the Announcement now (so it
 * appears correctly once its own publish time arrives, per
 * `listActiveAnnouncements`'s own read-time filter) but only notifies
 * members once it's actually live — this action re-checks against `now`
 * rather than assume "created" means "published."
 */
export async function publishAnnouncementAction(input: CreateAnnouncementInput): Promise<DataResult<Announcement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const authorName = session.profile.full_name ?? "A workspace admin";
  const result = await mockAnnouncementRepository.createAnnouncement(session.workspace.id, session.membership.id, authorName, input);
  if (!result.success) return result;

  const now = new Date().toISOString();
  if (result.data.publish_at <= now) {
    const members = await getWorkspaceMembers();
    await Promise.all(
      members
        .filter((member) => member.id !== session.membership.id)
        .map((member) =>
          getCoreNotificationsService().createInAppNotification(
            session.workspace.id,
            buildNotificationInput({
              kind: "announcement_published",
              recipientMemberId: member.id,
              title: result.data.title,
              body: result.data.body,
              relatedOwnerType: "workspace",
              relatedOwnerId: session.workspace.id,
              priorityOverride: result.data.priority === "critical" ? "critical" : result.data.priority === "important" ? "high" : undefined,
            }),
          ),
        ),
    );
  }

  return result;
}

async function requireOwnedAnnouncement(id: string, workspaceId: string): Promise<Announcement | null> {
  const announcements = await mockAnnouncementRepository.listAllAnnouncements(workspaceId);
  return announcements.find((a) => a.id === id) ?? null;
}

export async function acknowledgeAnnouncementAction(id: string): Promise<DataResult<Announcement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedAnnouncement(id, session.workspace.id))) return { success: false, error: "Announcement not found." };
  return mockAnnouncementRepository.acknowledgeAnnouncement(id, session.membership.id);
}

export async function deleteAnnouncementAction(id: string): Promise<DataResult<Announcement>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedAnnouncement(id, session.workspace.id))) return { success: false, error: "Announcement not found." };
  return mockAnnouncementRepository.deleteAnnouncement(id);
}
