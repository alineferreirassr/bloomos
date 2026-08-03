import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  getWorkspaceSummaryAction,
  saveWorkspaceLayoutAction,
  resetWorkspaceLayoutAction,
  toggleFavoriteAction,
  removeFavoriteAction,
  recordRecentItemAction,
  searchWorkspaceAction,
} from "@/modules/workspace/workspaceActions";
import { resetAllMockData } from "@/lib/data";
import { resetWorkspaceLayoutStore } from "@/lib/data/mock/workspaceLayoutStore";
import { resetWorkspaceFavoritesStore } from "@/lib/data/mock/workspaceFavoritesStore";
import { resetWorkspaceRecentItemsStore } from "@/lib/data/mock/workspaceRecentItemsStore";
import { defaultWorkspaceWidgets } from "@/core/workspace/widgetRegistry";
import { workspaceSearchProvider } from "@/core/workspace/workspaceSearchProvider";
import { setActiveSearchProvider } from "@/core/search/service";
import { registerDefaultSearchableEntities } from "@/core/search/defaultRegistrations";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.view", "workspace.customize", "communications.view", "analytics.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllMockData();
  resetWorkspaceLayoutStore();
  resetWorkspaceFavoritesStore();
  resetWorkspaceRecentItemsStore();
}

describe("workspaceActions", () => {
  beforeEach(() => {
    resetAll();
    registerDefaultSearchableEntities();
    setActiveSearchProvider(workspaceSearchProvider);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  });

  afterEach(() => {
    vi.mocked(resolveMemberSessionSnapshot).mockReset();
  });

  describe("getWorkspaceSummaryAction", () => {
    it("denies access without workspace.view", async () => {
      vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
      const result = await getWorkspaceSummaryAction();
      expect(result.success).toBe(false);
    });

    it("composes every section from real platform actions, degrading gracefully where a permission is missing", async () => {
      const result = await getWorkspaceSummaryAction();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.layout.widgets.length).toBeGreaterThan(0);
      expect(result.data.health.platforms.length).toBeGreaterThan(0);
      expect(result.data.quickActions.length).toBeGreaterThan(0);
      expect(typeof result.data.health.overallScore).toBe("number");
      expect(result.data.activityDigest).toBeDefined();
      expect(Array.isArray(result.data.recommendations)).toBe(true);
    });

    it("falls back to a default layout when none has been saved yet", async () => {
      const result = await getWorkspaceSummaryAction();
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.layout.widgets).toEqual(defaultWorkspaceWidgets());
    });
  });

  describe("saveWorkspaceLayoutAction / resetWorkspaceLayoutAction", () => {
    it("persists a widget layout and returns it from the next summary load", async () => {
      const widgets = defaultWorkspaceWidgets().map((w) => (w.widgetId === "favorites" ? { ...w, hidden: true } : w));
      const saved = await saveWorkspaceLayoutAction(widgets);
      expect(saved.success).toBe(true);

      const summary = await getWorkspaceSummaryAction();
      expect(summary.success).toBe(true);
      if (!summary.success) return;
      expect(summary.data.layout.widgets.find((w) => w.widgetId === "favorites")?.hidden).toBe(true);
    });

    it("rejects an unknown widget id", async () => {
      const widgets = [{ widgetId: "not_a_real_widget" as never, pinned: false, hidden: false, order: 0 }];
      const result = await saveWorkspaceLayoutAction(widgets);
      expect(result.success).toBe(false);
    });

    it("resetWorkspaceLayoutAction restores the default layout", async () => {
      await saveWorkspaceLayoutAction(defaultWorkspaceWidgets().map((w) => ({ ...w, hidden: true })));
      const reset = await resetWorkspaceLayoutAction();
      expect(reset.success).toBe(true);
      if (!reset.success) return;
      expect(reset.data.widgets).toEqual(defaultWorkspaceWidgets());
    });

    it("denies layout writes without workspace.customize", async () => {
      vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: ["workspace.view"] });
      const result = await saveWorkspaceLayoutAction(defaultWorkspaceWidgets());
      expect(result.success).toBe(false);
    });
  });

  describe("toggleFavoriteAction / removeFavoriteAction", () => {
    it("adds a favorite on first toggle and removes it on second toggle", async () => {
      const added = await toggleFavoriteAction("lead", "lead_1", "Sofia Marchetti", "/leads/lead_1");
      expect(added.success).toBe(true);
      if (!added.success) return;
      expect(added.data).toHaveLength(1);

      const removed = await toggleFavoriteAction("lead", "lead_1", "Sofia Marchetti", "/leads/lead_1");
      expect(removed.success).toBe(true);
      if (!removed.success) return;
      expect(removed.data).toHaveLength(0);
    });

    it("removeFavoriteAction removes by id", async () => {
      const added = await toggleFavoriteAction("client", "client_1", "Daniel Reyes", "/clients/client_1");
      expect(added.success).toBe(true);
      if (!added.success) return;

      const removed = await removeFavoriteAction(added.data[0]!.id);
      expect(removed.success).toBe(true);
      if (!removed.success) return;
      expect(removed.data).toHaveLength(0);
    });
  });

  describe("recordRecentItemAction", () => {
    it("records a view and de-dupes repeat views of the same entity", async () => {
      await recordRecentItemAction("event", "event_1", "Malibu Sunset", "/events/event_1");
      const second = await recordRecentItemAction("event", "event_1", "Malibu Sunset", "/events/event_1");
      expect(second.success).toBe(true);
      if (!second.success) return;
      expect(second.data).toHaveLength(1);
    });
  });

  describe("searchWorkspaceAction", () => {
    it("finds a seeded lead by name", async () => {
      const result = await searchWorkspaceAction("Sofia");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.some((r) => r.entityType === "lead")).toBe(true);
    });

    it("returns no results for a blank query", async () => {
      const result = await searchWorkspaceAction("");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual([]);
    });
  });
});
