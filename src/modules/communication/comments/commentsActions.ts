"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreCommentsService } from "@/core/comments";
import { getCoreNotificationsService } from "@/core/notifications";
import { buildNotificationInput } from "@/core/communication/notificationEngine";
import { parseMentions } from "@/core/communication/mentionEngine";
import { getWorkspaceMembers } from "@/lib/data";
import type { EntityType } from "@/core/enums/entityType";
import type { Comment } from "@/types/comment";
import type { DataResult } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "Comments aren't available. You may not have access to them.";

export async function getCommentsForOwnerAction(ownerType: EntityType, ownerId: string): Promise<DataResult<Comment[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const comments = await getCoreCommentsService().getCommentsForOwner(session.workspace.id, ownerType, ownerId);
  return { success: true, data: comments };
}

/**
 * v2.0 Checkpoint 24, Step 5/6 — Comments Platform + Mentions. Parses
 * `@Name`/`@Team` tokens against the real Workspace roster
 * (`core/comments` itself has no roster to parse against — that's the one
 * reason this checkpoint's own module layer exists here rather than
 * calling `getCoreCommentsService().createComment()` directly from the UI),
 * then fans out one real `comment_mention` Notification per mentioned
 * member (never the comment's own author, who obviously doesn't need to be
 * notified of their own mention of themselves).
 */
export async function createCommentAction(ownerType: EntityType, ownerId: string, body: string, parentCommentId: string | null = null): Promise<DataResult<Comment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const members = await getWorkspaceMembers();
  const { mentionedMemberIds, mentionsTeam } = parseMentions(
    body,
    members.filter((m) => m.full_name !== null).map((m) => ({ id: m.id, fullName: m.full_name as string })),
  );

  const authorName = session.profile.full_name ?? "A team member";
  const result = await getCoreCommentsService().createComment(session.workspace.id, authorName, ownerType, ownerId, {
    body,
    parentCommentId,
    mentionedMemberIds,
    mentionsTeam,
  });
  if (!result.success) return result;

  const notifyMemberIds = mentionsTeam ? members.map((m) => m.id).filter((id) => id !== session.membership.id) : mentionedMemberIds.filter((id) => id !== session.membership.id);

  await Promise.all(
    notifyMemberIds.map((memberId) =>
      getCoreNotificationsService().createInAppNotification(
        session.workspace.id,
        buildNotificationInput({
          kind: "comment_mention",
          recipientMemberId: memberId,
          title: `${authorName} mentioned you`,
          body: result.data.body,
          relatedOwnerType: ownerType,
          relatedOwnerId: ownerId,
        }),
      ),
    ),
  );

  return result;
}

async function requireOwnedComment(id: string, workspaceId: string): Promise<Comment | null> {
  const workspaceComments = await getCoreCommentsService().getAllCommentsForWorkspace(workspaceId);
  return workspaceComments.find((c) => c.id === id) ?? null;
}

export async function updateCommentAction(id: string, body: string): Promise<DataResult<Comment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedComment(id, session.workspace.id))) return { success: false, error: "Comment not found." };
  return getCoreCommentsService().updateComment(id, body);
}

export async function deleteCommentAction(id: string): Promise<DataResult<Comment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await requireOwnedComment(id, session.workspace.id))) return { success: false, error: "Comment not found." };
  return getCoreCommentsService().deleteComment(id);
}
