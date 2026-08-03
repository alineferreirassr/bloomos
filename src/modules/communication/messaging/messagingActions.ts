"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockMessageThreadRepository } from "@/lib/data/core/communication/messageThreadStore";
import { getCoreNotificationsService } from "@/core/notifications";
import { buildNotificationInput } from "@/core/communication/notificationEngine";
import { parseMentions } from "@/core/communication/mentionEngine";
import { getWorkspaceMembers } from "@/lib/data";
import type { InternalMessage, InternalMessageThread } from "@/types/communication";
import type { DataResult } from "@/lib/data/result";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const GENERIC_ACCESS_ERROR = "Messaging isn't available. You may not have access to it.";

export interface ThreadWithLastMessage {
  thread: InternalMessageThread;
  unreadCount: number;
}

/** Fetches a thread and confirms it belongs to the caller's workspace and the caller is a participant, so a threadId from another workspace or another member's private thread can never be read or mutated. */
async function requireThreadAccess(threadId: string, session: Extract<MemberSessionSnapshot, { kind: "active" }>): Promise<DataResult<InternalMessageThread>> {
  const thread = await mockMessageThreadRepository.getThread(threadId);
  if (!thread || thread.workspace_id !== session.workspace.id || !thread.participant_member_ids.includes(session.membership.id)) {
    return { success: false, error: "Conversation not found." };
  }
  return { success: true, data: thread };
}

export async function listMyThreadsAction(): Promise<DataResult<ThreadWithLastMessage[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const threads = await mockMessageThreadRepository.listThreadsForMember(session.workspace.id, session.membership.id);
  const withUnread = await Promise.all(
    threads.map(async (thread) => {
      const messages = await mockMessageThreadRepository.listMessages(thread.id);
      const unreadCount = messages.filter((m) => !m.read_by_member_ids.includes(session.membership.id)).length;
      return { thread, unreadCount };
    }),
  );
  return { success: true, data: withUnread };
}

export async function getThreadMessagesAction(threadId: string): Promise<DataResult<InternalMessage[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const access = await requireThreadAccess(threadId, session);
  if (!access.success) return access;
  const messages = await mockMessageThreadRepository.listMessages(threadId);
  return { success: true, data: messages };
}

export async function startDirectThreadAction(otherMemberId: string): Promise<DataResult<InternalMessageThread>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const thread = await mockMessageThreadRepository.findOrCreateDirectThread(session.workspace.id, session.membership.id, otherMemberId);
  return { success: true, data: thread };
}

export async function createTeamThreadAction(participantMemberIds: string[], subject: string): Promise<DataResult<InternalMessageThread>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  return mockMessageThreadRepository.createTeamThread(session.workspace.id, session.membership.id, participantMemberIds, subject);
}

/** Sends a message and, for every other participant, one real `message_received` Notification (only if the message body doesn't already trigger `comment_mention`-style notifications elsewhere — Internal Messaging and Comments are separate features with separate notification kinds). */
export async function sendMessageAction(threadId: string, body: string): Promise<DataResult<InternalMessage>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const access = await requireThreadAccess(threadId, session);
  if (!access.success) return access;
  const thread = access.data;

  const members = await getWorkspaceMembers();
  const { mentionedMemberIds } = parseMentions(
    body,
    members.filter((m) => m.full_name !== null).map((m) => ({ id: m.id, fullName: m.full_name as string })),
  );

  const authorName = session.profile.full_name ?? "A team member";
  const result = await mockMessageThreadRepository.sendMessage(threadId, session.membership.id, authorName, body, mentionedMemberIds);
  if (!result.success) return result;

  const otherParticipants = thread.participant_member_ids.filter((id) => id !== session.membership.id);
  await Promise.all(
    otherParticipants.map((memberId) =>
      getCoreNotificationsService().createInAppNotification(
        session.workspace.id,
        buildNotificationInput({
          kind: mentionedMemberIds.includes(memberId) ? "comment_mention" : "message_received",
          recipientMemberId: memberId,
          title: `${authorName} sent a message`,
          body: result.data.body,
        }),
      ),
    ),
  );

  return result;
}

export async function markThreadReadAction(threadId: string): Promise<DataResult<number>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const access = await requireThreadAccess(threadId, session);
  if (!access.success) return access;
  return mockMessageThreadRepository.markThreadRead(threadId, session.membership.id);
}

export async function setThreadPinnedAction(threadId: string, pinned: boolean): Promise<DataResult<InternalMessageThread>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const access = await requireThreadAccess(threadId, session);
  if (!access.success) return access;
  return mockMessageThreadRepository.setThreadPinned(threadId, session.membership.id, pinned);
}

export async function setThreadArchivedAction(threadId: string, archived: boolean): Promise<DataResult<InternalMessageThread>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const access = await requireThreadAccess(threadId, session);
  if (!access.success) return access;
  return mockMessageThreadRepository.setThreadArchived(threadId, session.membership.id, archived);
}
