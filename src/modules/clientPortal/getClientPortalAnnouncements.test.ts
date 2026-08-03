import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn().mockResolvedValue({ kind: "unauthenticated" }),
}));

import { resetAllMockData } from "@/lib/data";
import { mockAnnouncementRepository, resetAnnouncementStore } from "@/lib/data/core/communication/announcementStore";
import { getClientPortalAnnouncementsAction } from "@/modules/clientPortal/getClientPortalAnnouncements";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  resetAllMockData();
  resetAnnouncementStore();
});

describe("getClientPortalAnnouncementsAction", () => {
  it("returns the workspace's published, unexpired announcements", async () => {
    await mockAnnouncementRepository.createAnnouncement(CURRENT_WORKSPACE_ID, "member_1", "Ana Ferreira", {
      title: "Studio closed for the holidays",
      body: "We'll be back on January 6th.",
    });

    const result = await getClientPortalAnnouncementsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.some((a) => a.title === "Studio closed for the holidays")).toBe(true);
  });

  it("excludes an announcement scheduled to publish in the future", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    await mockAnnouncementRepository.createAnnouncement(CURRENT_WORKSPACE_ID, "member_1", "Ana Ferreira", {
      title: "Future announcement",
      body: "Not live yet.",
      publishAt: future,
    });

    const result = await getClientPortalAnnouncementsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.some((a) => a.title === "Future announcement")).toBe(false);
  });

  it("returns an empty list when nothing has been published", async () => {
    const result = await getClientPortalAnnouncementsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });
});
