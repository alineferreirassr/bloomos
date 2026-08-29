import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerGlobalCommands } from "@/core/commandPalette/registerGlobalCommands";
import { SUPPLEMENTARY_NAVIGATION_COMMANDS } from "@/core/commandPalette/navigationCommands";
import { getCommandById, getCommands, resetCommandRegistry } from "@/core/commandPalette/registry";
import { getVisibleNavigationModules, navigationModules, NAV_GROUP_LABELS } from "@/config/navigation";
import type { Permission } from "@/core/enums/permission";

const allow = (): boolean => true;
const denyOnly = (...denied: Permission[]) => (permission: Permission) => !denied.includes(permission);

describe("registerGlobalCommands — single source of truth for navigation", () => {
  beforeEach(() => {
    resetCommandRegistry();
  });

  it("registers exactly one command per permission-visible navigationModules entry with an href — drift is structurally impossible since these are derived, not re-typed", () => {
    registerGlobalCommands(vi.fn(), allow);
    const visible = getVisibleNavigationModules(allow).filter((m) => m.href);
    for (const navModule of visible) {
      const command = getCommandById(`nav-${navModule.id}`);
      expect(command, `expected a command for nav module "${navModule.id}"`).toBeDefined();
      expect(command?.label).toBe(`Open ${navModule.label}`);
      expect(command?.group).toBe(NAV_GROUP_LABELS[navModule.group]);
    }
  });

  it("a Cmd+K command's run() navigates to the exact same href its sidebar module points at", () => {
    const navigate = vi.fn();
    registerGlobalCommands(navigate, allow);
    getCommandById("nav-leads")?.run();
    expect(navigate).toHaveBeenCalledWith("/leads");
  });

  it("does not register a command for a route the current member lacks permission for — unauthorized destinations never become discoverable through Cmd+K", () => {
    registerGlobalCommands(vi.fn(), denyOnly("finance.view", "team.view", "workspace.manage"));
    expect(getCommandById("nav-finance")).toBeUndefined();
    expect(getCommandById("nav-team")).toBeUndefined();
    expect(getCommandById("nav-settings")).toBeUndefined();
    expect(getCommandById("nav-developer")).toBeUndefined();
  });

  it("registers the full staff-permitted command set and nothing beyond it, for the same seeded staff permission matrix navigation.test.ts already validates against the sidebar", () => {
    const staffPermissions = new Set<Permission>([
      "workspace.view",
      "team.view",
      "leads.view",
      "clients.view",
      "events.view",
      "contracts.view",
      "finance.view",
      "documents.view",
      "clients.portal_view",
      "communications.view",
      "notifications.view",
      "notifications.preferences",
      "assets.view",
      "scheduling.view",
      "allocations.view",
      "operational_planning.view",
      "execution_packages.view",
      "dispatch.view",
      "field_operations.view",
      "route_optimization.view",
      "operations_center.view",
      "client_journeys.view",
      "proposal_builder.view",
      "reports.view",
    ]);
    const staffCan = (permission: Permission) => staffPermissions.has(permission);
    registerGlobalCommands(vi.fn(), staffCan);

    const staffVisibleIds = getVisibleNavigationModules(staffCan)
      .filter((m) => m.href)
      .map((m) => `nav-${m.id}`);
    const registeredNavIds = getCommands()
      .map((c) => c.id)
      .filter((id) => id.startsWith("nav-") && navigationModules.some((m) => `nav-${m.id}` === id));

    expect(registeredNavIds.sort()).toEqual(staffVisibleIds.sort());
    expect(getCommandById("nav-analytics")).toBeUndefined();
    expect(getCommandById("nav-settings")).toBeUndefined();
  });

  it("registers supplementary (non-sidebar) destinations only when the member has the underlying route permission", () => {
    registerGlobalCommands(vi.fn(), denyOnly("workspace.manage"));
    // /assets/business-health only needs assets.view (granted by `allow-everything-except-workspace.manage`).
    expect(getCommandById("nav-business-health")).toBeDefined();
    // /search/analytics needs workspace.manage specifically — denied here.
    expect(getCommandById("nav-search-analytics")).toBeUndefined();
    // /search itself is active-membership-only — always registered regardless of permission.
    expect(getCommandById("nav-global-search")).toBeDefined();
  });

  it("the supplementary list contains no href already present in navigationModules — it is additive, never a second catalog of the same routes", () => {
    const sidebarHrefs = new Set(navigationModules.map((m) => m.href).filter(Boolean));
    for (const extra of SUPPLEMENTARY_NAVIGATION_COMMANDS) {
      expect(sidebarHrefs.has(extra.href), `"${extra.href}" is a supplementary command AND a sidebar module — that is exactly the drift this file exists to prevent`).toBe(false);
    }
  });

  it("every supplementary command's group reuses a real NAV_GROUP_LABELS value, never an ad-hoc group name the sidebar wouldn't recognize", () => {
    const validLabels = new Set(Object.values(NAV_GROUP_LABELS));
    registerGlobalCommands(vi.fn(), allow);
    for (const extra of SUPPLEMENTARY_NAVIGATION_COMMANDS) {
      const command = getCommandById(extra.id);
      expect(command?.group && validLabels.has(command.group)).toBe(true);
    }
  });

  it("registers Quick Actions unchanged, alongside the derived navigation commands", () => {
    registerGlobalCommands(vi.fn(), allow);
    expect(getCommandById("quick-new_lead")).toBeDefined();
    expect(getCommandById("quick-new_lead")?.label).toBe("New Lead");
  });

  it("the returned unregister function removes every command it registered — navigation, supplementary, and quick actions alike", () => {
    const unregister = registerGlobalCommands(vi.fn(), allow);
    expect(getCommands().length).toBeGreaterThan(0);
    unregister();
    expect(getCommands()).toEqual([]);
  });
});
