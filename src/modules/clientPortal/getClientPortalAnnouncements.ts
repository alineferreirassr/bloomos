"use server";

import { getCurrentClientAccountContext } from "@/lib/data";
import { mockAnnouncementRepository } from "@/lib/data/core/communication/announcementStore";
import type { Announcement } from "@/types/communication";
import type { DataResult } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "Announcements aren't available. You may not have access to them.";

/**
 * Checkpoint 36, Step 1/7 — the Client Portal's own read-only Announcements
 * accessor. Workspace-wide Announcements are already visible to every team
 * member via `listActiveAnnouncementsAction`'s own `communications.view`
 * gate; a client sees the exact same published rows, gated instead by the
 * `ClientAccount` session, the same split every other Client Portal reader
 * uses. No second Announcement store — this only reads the one
 * `mockAnnouncementRepository` Checkpoint 24 already built.
 */
export async function getClientPortalAnnouncementsAction(): Promise<DataResult<Announcement[]>> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  const announcements = await mockAnnouncementRepository.listActiveAnnouncements(context.account.workspace_id);
  return { success: true, data: announcements };
}
