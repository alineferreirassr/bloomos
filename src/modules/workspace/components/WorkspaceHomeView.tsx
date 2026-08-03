"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getWorkspaceSummaryAction, removeFavoriteAction, saveWorkspaceLayoutAction, resetWorkspaceLayoutAction, type WorkspaceSummary } from "@/modules/workspace/workspaceActions";
import { registerDefaultWorkspaceCommands } from "@/modules/workspace/registerWorkspaceCommands";
import { visibleWidgetsInOrder, toggleWidgetHidden, toggleWidgetPinned, reorderWidget } from "@/core/workspace/widgetRegistry";
import { WORKSPACE_WIDGET_LABELS, WORKSPACE_WIDGET_DESCRIPTIONS, type WorkspaceWidgetPreference, type WorkspaceWidgetType } from "@/types/smartWorkspace";
import { WidgetCard } from "@/modules/workspace/components/WidgetCard";
import { ExecutiveOverviewWidget } from "@/modules/workspace/components/widgets/ExecutiveOverviewWidget";
import { BusinessOverviewWidget } from "@/modules/workspace/components/widgets/BusinessOverviewWidget";
import { OperationalOverviewWidget } from "@/modules/workspace/components/widgets/OperationalOverviewWidget";
import { AnalyticsOverviewWidget } from "@/modules/workspace/components/widgets/AnalyticsOverviewWidget";
import { ActivityFeedWidget } from "@/modules/workspace/components/widgets/ActivityFeedWidget";
import { GlobalSearchWidget } from "@/modules/workspace/components/widgets/GlobalSearchWidget";
import { FavoritesWidget } from "@/modules/workspace/components/widgets/FavoritesWidget";
import { RecentItemsWidget } from "@/modules/workspace/components/widgets/RecentItemsWidget";
import { QuickActionsWidget } from "@/modules/workspace/components/widgets/QuickActionsWidget";
import { WorkspaceHealthWidget } from "@/modules/workspace/components/widgets/WorkspaceHealthWidget";
import { KnowledgeGraphWidget } from "@/modules/workspace/components/widgets/KnowledgeGraphWidget";
import { RecommendationsWidget } from "@/modules/workspace/components/widgets/RecommendationsWidget";
import { ReportsOverviewWidget } from "@/modules/workspace/components/widgets/ReportsOverviewWidget";

registerDefaultWorkspaceCommands();

/**
 * v2.0 Checkpoint 38, Step 12 — Smart Workspace Home. The new unified
 * entry point: one customizable grid composing Executive Decisions,
 * Business Health, Operations Center, Executive Analytics & BI, the
 * Communication Platform's Timeline, Global Search, and the Knowledge
 * Graph — every widget below is a thin presentation layer over an
 * already-real platform action (see each widget's own doc comment for its
 * specific reuse). Favorites, Recent Items, and widget layout itself are
 * the only genuinely new state this checkpoint introduces.
 */
export function WorkspaceHomeView() {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getWorkspaceSummaryAction().then((result) => setSummary(result.success ? result.data : null));
  }, []);

  if (!summary) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Workspace" subtitle="Your unified home for BloomOS." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  async function persistWidgets(nextWidgets: WorkspaceWidgetPreference[]) {
    setSummary((prev) => (prev ? { ...prev, layout: { ...prev.layout, widgets: nextWidgets } } : prev));
    setSaving(true);
    await saveWorkspaceLayoutAction(nextWidgets);
    setSaving(false);
  }

  function handleHide(widgetId: WorkspaceWidgetType) {
    if (!summary) return;
    void persistWidgets(toggleWidgetHidden(summary.layout.widgets, widgetId));
  }

  function handleTogglePin(widgetId: WorkspaceWidgetType) {
    if (!summary) return;
    void persistWidgets(toggleWidgetPinned(summary.layout.widgets, widgetId));
  }

  function handleMove(widgetId: WorkspaceWidgetType, direction: "up" | "down") {
    if (!summary) return;
    void persistWidgets(reorderWidget(summary.layout.widgets, widgetId, direction));
  }

  async function handleResetLayout() {
    setSaving(true);
    const result = await resetWorkspaceLayoutAction();
    if (result.success) setSummary((prev) => (prev ? { ...prev, layout: result.data } : prev));
    setSaving(false);
  }

  async function handleRemoveFavorite(favoriteId: string) {
    setSummary((prev) => (prev ? { ...prev, favorites: prev.favorites.filter((f) => f.id !== favoriteId) } : prev));
    await removeFavoriteAction(favoriteId);
  }

  const visibleWidgets = visibleWidgetsInOrder(summary.layout.widgets);
  const allHiddenWidgets = summary.layout.widgets.filter((w) => w.hidden);

  function renderWidgetBody(widgetId: WorkspaceWidgetType) {
    switch (widgetId) {
      case "executive_overview":
        return <ExecutiveOverviewWidget brief={summary!.executiveBrief} />;
      case "business_overview":
        return <BusinessOverviewWidget health={summary!.health} />;
      case "operational_overview":
        return <OperationalOverviewWidget health={summary!.health} />;
      case "analytics_overview":
        return <AnalyticsOverviewWidget analytics={summary!.analytics} />;
      case "activity_feed":
        return <ActivityFeedWidget entries={summary!.recentActivity} digest={summary!.activityDigest} />;
      case "global_search":
        return <GlobalSearchWidget />;
      case "favorites":
        return <FavoritesWidget favorites={summary!.favorites} onRemove={handleRemoveFavorite} />;
      case "recent_items":
        return <RecentItemsWidget recentItems={summary!.recentItems} />;
      case "quick_actions":
        return <QuickActionsWidget quickActions={summary!.quickActions} />;
      case "workspace_health":
        return <WorkspaceHealthWidget health={summary!.health} />;
      case "knowledge_graph":
        return <KnowledgeGraphWidget graphStats={summary!.graphStats} />;
      case "recommendations":
        return <RecommendationsWidget recommendations={summary!.recommendations} />;
      case "reports_overview":
        return <ReportsOverviewWidget reportsSummary={summary!.reportsSummary} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workspace"
        subtitle="Your unified home for BloomOS — search, health, activity, and priorities in one place."
        actions={
          <div className="flex items-center gap-2">
            {customizing ? (
              <Button type="button" variant="secondary" onClick={handleResetLayout} disabled={saving}>
                Reset to Default
              </Button>
            ) : null}
            <Button type="button" variant={customizing ? "primary" : "secondary"} onClick={() => setCustomizing((v) => !v)}>
              {customizing ? "Done Customizing" : "Customize Widgets"}
            </Button>
          </div>
        }
      />

      {customizing && allHiddenWidgets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 text-sm">
          <span className="text-text-muted">Hidden:</span>
          {allHiddenWidgets.map((widget) => (
            <Button key={widget.widgetId} type="button" variant="ghost" className="!px-2 text-xs" onClick={() => handleHide(widget.widgetId)}>
              Show {WORKSPACE_WIDGET_LABELS[widget.widgetId]}
            </Button>
          ))}
        </div>
      ) : null}

      {visibleWidgets.length === 0 ? (
        <EmptyState title="Every widget is hidden" description="Use Customize Widgets to bring one back." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleWidgets.map((widget, index) => (
            <WidgetCard
              key={widget.widgetId}
              title={WORKSPACE_WIDGET_LABELS[widget.widgetId]}
              description={WORKSPACE_WIDGET_DESCRIPTIONS[widget.widgetId]}
              customizing={customizing}
              pinned={widget.pinned}
              onHide={() => handleHide(widget.widgetId)}
              onTogglePin={() => handleTogglePin(widget.widgetId)}
              onMoveUp={() => handleMove(widget.widgetId, "up")}
              onMoveDown={() => handleMove(widget.widgetId, "down")}
              canMoveUp={index > 0}
              canMoveDown={index < visibleWidgets.length - 1}
              className={widget.widgetId === "quick_actions" || widget.widgetId === "activity_feed" || widget.widgetId === "global_search" ? "md:col-span-2" : undefined}
            >
              {renderWidgetBody(widget.widgetId)}
            </WidgetCard>
          ))}
        </div>
      )}
    </div>
  );
}
