import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));

import { resetAllMockData } from "@/lib/data";
import { resetAnnouncementStore, mockAnnouncementRepository } from "@/lib/data/core/communication/announcementStore";
import { getClientPortalCommunicationSummaryAction } from "@/modules/clientPortal/getClientPortalCommunicationSummary";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  resetAllMockData();
  resetAnnouncementStore();
});

describe("getClientPortalCommunicationSummaryAction", () => {
  it("returns the current client's unread counts and announcements in one composed summary", async () => {
    await mockAnnouncementRepository.createAnnouncement(CURRENT_WORKSPACE_ID, "member_1", "Ana Ferreira", {
      title: "New studio hours",
      body: "We're now open Saturdays.",
    });

    const result = await getClientPortalCommunicationSummaryAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(typeof result.data.unreadMessageCount).toBe("number");
    expect(typeof result.data.unreadNotificationCount).toBe("number");
    expect(result.data.announcements.some((a) => a.title === "New studio hours")).toBe(true);
    expect(Array.isArray(result.data.recentComments)).toBe(true);
  });

  it("never surfaces a mention (no client-safe mention accessor exists)", async () => {
    const result = await getClientPortalCommunicationSummaryAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(JSON.stringify(result.data)).not.toContain("mention");
  });
});
