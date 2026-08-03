import { describe, expect, it } from "vitest";
import { WORKSPACE_WIDGET_TYPES } from "@/types/smartWorkspace";
import { defaultWorkspaceWidgets, isKnownWidgetId, reorderWidget, resetToDefaultWidgets, toggleWidgetHidden, toggleWidgetPinned, visibleWidgetsInOrder } from "@/core/workspace/widgetRegistry";

describe("widgetRegistry", () => {
  it("defaultWorkspaceWidgets includes every known widget type, unhidden and unpinned", () => {
    const widgets = defaultWorkspaceWidgets();
    expect(widgets).toHaveLength(WORKSPACE_WIDGET_TYPES.length);
    expect(widgets.every((w) => !w.hidden && !w.pinned)).toBe(true);
  });

  it("isKnownWidgetId narrows to a real widget type", () => {
    expect(isKnownWidgetId("workspace_health")).toBe(true);
    expect(isKnownWidgetId("not_a_widget")).toBe(false);
  });

  it("visibleWidgetsInOrder drops hidden widgets and sorts pinned first", () => {
    const widgets = defaultWorkspaceWidgets();
    const hidden = toggleWidgetHidden(widgets, "quick_actions");
    const pinned = toggleWidgetPinned(hidden, "recommendations");

    const visible = visibleWidgetsInOrder(pinned);
    expect(visible.some((w) => w.widgetId === "quick_actions")).toBe(false);
    expect(visible[0]!.widgetId).toBe("recommendations");
  });

  it("reorderWidget swaps order with the adjacent widget", () => {
    const widgets = defaultWorkspaceWidgets();
    const second = widgets[1]!.widgetId;
    const moved = reorderWidget(widgets, second, "up");
    const sorted = [...moved].sort((a, b) => a.order - b.order);
    expect(sorted[0]!.widgetId).toBe(second);
  });

  it("reorderWidget is a no-op at the boundary", () => {
    const widgets = defaultWorkspaceWidgets();
    const first = widgets[0]!.widgetId;
    const moved = reorderWidget(widgets, first, "up");
    expect(moved).toEqual(widgets);
  });

  it("resetToDefaultWidgets matches defaultWorkspaceWidgets", () => {
    expect(resetToDefaultWidgets()).toEqual(defaultWorkspaceWidgets());
  });
});
