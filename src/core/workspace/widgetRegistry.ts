import { WORKSPACE_WIDGET_TYPES, type WorkspaceWidgetPreference, type WorkspaceWidgetType } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 6 — Widget Registry. Pure layout logic only —
 * no I/O. Mirrors `dashboardLayoutActions.ts`'s `defaultLayout()`
 * (Checkpoint 23, Step 14): every known widget id, in a sensible default
 * order, none hidden, none pinned.
 */
export function defaultWorkspaceWidgets(): WorkspaceWidgetPreference[] {
  return WORKSPACE_WIDGET_TYPES.map((widgetId, order) => ({ widgetId, pinned: false, hidden: false, order }));
}

export function isKnownWidgetId(value: string): value is WorkspaceWidgetType {
  return (WORKSPACE_WIDGET_TYPES as readonly string[]).includes(value);
}

/** Visible widgets in display order: pinned first (by their own order), then the rest (by their own order), hidden ones dropped. */
export function visibleWidgetsInOrder(widgets: WorkspaceWidgetPreference[]): WorkspaceWidgetPreference[] {
  const visible = widgets.filter((w) => !w.hidden);
  const pinned = visible.filter((w) => w.pinned).sort((a, b) => a.order - b.order);
  const unpinned = visible.filter((w) => !w.pinned).sort((a, b) => a.order - b.order);
  return [...pinned, ...unpinned];
}

export function toggleWidgetHidden(widgets: WorkspaceWidgetPreference[], widgetId: WorkspaceWidgetType): WorkspaceWidgetPreference[] {
  return widgets.map((w) => (w.widgetId === widgetId ? { ...w, hidden: !w.hidden } : w));
}

export function toggleWidgetPinned(widgets: WorkspaceWidgetPreference[], widgetId: WorkspaceWidgetType): WorkspaceWidgetPreference[] {
  return widgets.map((w) => (w.widgetId === widgetId ? { ...w, pinned: !w.pinned } : w));
}

/** Moves one widget's `order` up/down relative to its neighbors, swapping the two `order` values so every widget keeps a unique, stable rank. */
export function reorderWidget(widgets: WorkspaceWidgetPreference[], widgetId: WorkspaceWidgetType, direction: "up" | "down"): WorkspaceWidgetPreference[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((w) => w.widgetId === widgetId);
  if (index === -1) return widgets;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return widgets;

  const a = sorted[index];
  const b = sorted[swapWith];
  const aOrder = a.order;
  const bOrder = b.order;
  return widgets.map((w) => {
    if (w.widgetId === a.widgetId) return { ...w, order: bOrder };
    if (w.widgetId === b.widgetId) return { ...w, order: aOrder };
    return w;
  });
}

export function resetToDefaultWidgets(): WorkspaceWidgetPreference[] {
  return defaultWorkspaceWidgets();
}
