import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getSettingsDashboardData } from "@/modules/settings/getSettingsDashboardData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getSettingsManager } from "@/core/settings/manager";
import { resetSettingsStore } from "@/lib/data/core/settings/mockRepository";

const ownerSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_dashboard_test", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
  resetSettingsStore();
});

describe("getSettingsDashboardData", () => {
  it("returns an error when the session isn't active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getSettingsDashboardData();
    expect(result.success).toBe(false);
  });

  it("flags the unset required Workspace Name as missing configuration", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await getSettingsDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.missingConfiguration.some((issue) => issue.settingId === "workspace.name")).toBe(true);
    expect(result.data.health.healthPercent).toBeLessThan(100);
  });

  it("clears the missing-configuration warning once the required value is set", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    await getSettingsManager().setSettingValue("ws_dashboard_test", "workspace.name", "Amoré Bloom", "user_1");
    const result = await getSettingsDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.missingConfiguration.some((issue) => issue.settingId === "workspace.name")).toBe(false);
  });

  it("recommends enabling MFA by default (it starts disabled)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await getSettingsDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.recommendations.some((rec) => rec.settingId === "security.mfa-required")).toBe(true);
  });

  it("resolves a change's settingLabel from the registry rather than exposing the raw id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    await getSettingsManager().setSettingValue("ws_dashboard_test", "workspace.name", "Amoré Bloom", "user_1");
    const result = await getSettingsDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const change = result.data.recentChanges.find((c) => c.settingId === "workspace.name");
    expect(change?.settingLabel).toBe("Workspace Name");
    expect(change?.sectionId).toBe("workspace");
  });

  it("counts totalSettings as every setting visible to this member's permissions and role", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
    const result = await getSettingsDashboardData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.health.totalSettings).toBeGreaterThan(40);
  });
});
