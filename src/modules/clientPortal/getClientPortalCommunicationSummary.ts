"use server";

import { getCurrentClientAccountContext, getClientPortalThread, getClientPortalNotifications } from "@/lib/data";
import { getCoreCommentsService } from "@/core/comments";
import { getClientPortalAnnouncementsAction } from "@/modules/clientPortal/getClientPortalAnnouncements";
import { listClientPortalContractsAction } from "@/modules/clientPortal/getClientPortalContract";
import type { Announcement } from "@/types/communication";

const GENERIC_ACCESS_ERROR = "The Communication Center isn't available. Please sign in again.";

export interface ClientPortalCommunicationComment {
  id: string;
  ownerLabel: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ClientPortalCommunicationSummary {
  unreadMessageCount: number;
  unreadNotificationCount: number;
  announcements: Announcement[];
  recentComments: ClientPortalCommunicationComment[];
}

export type GetClientPortalCommunicationSummaryResult = { success: true; data: ClientPortalCommunicationSummary } | { success: false; error: string };

/**
 * Checkpoint 36, Step 7 — the Communication Center's own aggregator.
 * Messages (`getClientPortalThread`), Notifications
 * (`getClientPortalNotifications`), and Announcements
 * (`getClientPortalAnnouncementsAction`, Step 1) already have real,
 * tested accessors — this only adds "Comments": the same generic
 * Comments Platform `ClientPortalContractDocumentSection.tsx`'s own
 * "Review Requests" (Step 4) already posts into, read back here across
 * every one of the client's own published contracts (the only owner type
 * a client can currently see comments on). "Mentions" has no client-safe
 * equivalent — `@Name` mentions only ever resolve against the internal
 * Workspace member roster (`core/communication/mentionEngine.ts`), which
 * a `ClientAccount` is never part of — so it's intentionally not
 * surfaced here rather than faked. "Unified Communication Timeline" is
 * the existing `/client-access/timeline` page (Step 8) — linked to, not
 * duplicated.
 */
export async function getClientPortalCommunicationSummaryAction(): Promise<GetClientPortalCommunicationSummaryResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const [thread, notifications, announcementsResult, contractsResult] = await Promise.all([
    getClientPortalThread(),
    getClientPortalNotifications(),
    getClientPortalAnnouncementsAction(),
    listClientPortalContractsAction(),
  ]);

  const commentsService = getCoreCommentsService();
  const contracts = contractsResult.success ? contractsResult.data : [];
  const commentLists = await Promise.all(contracts.map((contract) => commentsService.getCommentsForOwner(context.account.workspace_id, "contract", contract.contractId)));
  const recentComments: ClientPortalCommunicationComment[] = contracts
    .flatMap((contract, index) => commentLists[index].map((comment) => ({ id: comment.id, ownerLabel: contract.title, author: comment.author, body: comment.body, createdAt: comment.created_at })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  return {
    success: true,
    data: {
      unreadMessageCount: thread.unread_count,
      unreadNotificationCount: notifications.filter((n) => n.read_at === null && n.archived_at === null).length,
      announcements: announcementsResult.success ? announcementsResult.data : [],
      recentComments,
    },
  };
}
