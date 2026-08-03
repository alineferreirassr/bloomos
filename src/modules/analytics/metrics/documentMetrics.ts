import { getDocumentsManager } from "@/core/documents/manager";
import { listClientPortalActivityForWorkspace } from "@/lib/data/clientPortal/clientPortalActivityStore";
import { listClientDocumentApprovalsForWorkspace } from "@/lib/data/clientPortal/clientDocumentApprovalStore";
import { registerMetric } from "@/core/analytics/metricRegistry";
import { buildMetricResult, filterInWindow, groupByDay } from "@/core/analytics/engine";
import type { MetricComputeContext, MetricComputeResult } from "@/types/analytics";

/**
 * Checkpoint 15 — Document category metrics. `documentsGenerated` reads
 * `getDocumentsManager().listComposedDocuments()` directly — the real
 * Document Platform (Checkpoint 12), never a duplicated counter.
 * Downloads/Views/Portal-approvals all read the Client Portal's own
 * Activity/Approval logs (Checkpoint 14) — the only place a real,
 * per-event download/view/decision is actually persisted today; the
 * internal Document viewer's own download button only logs to the
 * observability logger (`logDocumentDownloadAction.ts`), not a queryable
 * store, so it isn't counted here (see docs/analytics.md's own "Known
 * limitations").
 */

const templatesCount = {
  id: "documents.templates",
  name: "Templates",
  description: "Templates currently available to generate Documents from.",
  category: "documents" as const,
  unit: "count" as const,
  icon: "FileText",
  requiredPermissions: ["documents.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const templates = await getDocumentsManager().listTemplates(context.workspaceId);
    // A snapshot count, not a window-filtered flow — Templates are configuration, created rarely, so "how many exist right now" is the meaningful figure, the same reasoning `revenue.outstandingBalance` already documents for its own point-in-time metric.
    return buildMetricResult(templates.length, null);
  },
};

const documentsGenerated = {
  id: "documents.generated",
  name: "Documents Generated",
  description: "Documents compiled from a Template within the selected window.",
  category: "documents" as const,
  unit: "count" as const,
  icon: "FileText",
  requiredPermissions: ["documents.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const documents = await getDocumentsManager().listComposedDocuments(context.workspaceId);
    const dateOf = (document: (typeof documents)[number]) => document.createdAt;
    const current = filterInWindow(documents, dateOf, context.window).length;
    const previous = filterInWindow(documents, dateOf, context.previousWindow).length;
    const series = groupByDay(documents, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const documentDownloads = {
  id: "documents.downloads",
  name: "Portal Downloads",
  description: "Documents downloaded by a client through the Client Portal within the selected window.",
  category: "documents" as const,
  unit: "count" as const,
  icon: "Download",
  requiredPermissions: ["documents.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const activity = listClientPortalActivityForWorkspace(context.workspaceId).filter((entry) => entry.kind === "document_downloaded");
    const dateOf = (entry: (typeof activity)[number]) => entry.occurred_at;
    const current = filterInWindow(activity, dateOf, context.window).length;
    const previous = filterInWindow(activity, dateOf, context.previousWindow).length;
    const series = groupByDay(activity, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const documentViews = {
  id: "documents.views",
  name: "Portal Views",
  description: "Documents viewed by a client through the Client Portal within the selected window.",
  category: "documents" as const,
  unit: "count" as const,
  icon: "Eye",
  requiredPermissions: ["documents.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const activity = listClientPortalActivityForWorkspace(context.workspaceId).filter((entry) => entry.kind === "document_viewed");
    const dateOf = (entry: (typeof activity)[number]) => entry.occurred_at;
    const current = filterInWindow(activity, dateOf, context.window).length;
    const previous = filterInWindow(activity, dateOf, context.previousWindow).length;
    const series = groupByDay(activity, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const documentBundlesCreated = {
  id: "documents.bundlesCreated",
  name: "Document Bundles Created",
  description: "Document Bundles created within the selected window.",
  category: "documents" as const,
  unit: "count" as const,
  icon: "Package",
  requiredPermissions: ["documents.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const bundles = await getDocumentsManager().listDocumentBundlesForWorkspace(context.workspaceId);
    const dateOf = (bundle: (typeof bundles)[number]) => bundle.createdAt;
    const current = filterInWindow(bundles, dateOf, context.window).length;
    const previous = filterInWindow(bundles, dateOf, context.previousWindow).length;
    const series = groupByDay(bundles, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const documentBundleSendRate = {
  id: "documents.bundleSendRate",
  name: "Bundle Send Rate",
  description: "Share of Document Bundles created within the window that have been sent to a client.",
  category: "documents" as const,
  unit: "percent" as const,
  icon: "Send",
  requiredPermissions: ["documents.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const bundles = await getDocumentsManager().listDocumentBundlesForWorkspace(context.workspaceId);
    const dateOf = (bundle: (typeof bundles)[number]) => bundle.createdAt;

    const rateFor = (window: typeof context.window): number => {
      const cohort = filterInWindow(bundles, dateOf, window);
      if (cohort.length === 0) return 0;
      const sent = cohort.filter((bundle) => bundle.sentAt !== null).length;
      return (sent / cohort.length) * 100;
    };

    return buildMetricResult(rateFor(context.window), rateFor(context.previousWindow));
  },
};

const portalApprovals = {
  id: "documents.portalApprovals",
  name: "Portal Approval Rate",
  description: "Share of client Document decisions within the window that were approvals.",
  category: "documents" as const,
  unit: "percent" as const,
  icon: "CheckCircle2",
  requiredPermissions: ["documents.view" as const],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const approvals = listClientDocumentApprovalsForWorkspace(context.workspaceId).filter((approval) => approval.decided_at !== null);
    const dateOf = (approval: (typeof approvals)[number]) => approval.decided_at as string;

    const rateFor = (window: typeof context.window): number => {
      const cohort = filterInWindow(approvals, dateOf, window);
      if (cohort.length === 0) return 0;
      const approved = cohort.filter((approval) => approval.status === "approved").length;
      return (approved / cohort.length) * 100;
    };

    return buildMetricResult(rateFor(context.window), rateFor(context.previousWindow));
  },
};

let registered = false;

export function registerDocumentMetrics(): void {
  if (registered) return;
  registerMetric(templatesCount);
  registerMetric(documentsGenerated);
  registerMetric(documentDownloads);
  registerMetric(documentViews);
  registerMetric(portalApprovals);
  registerMetric(documentBundlesCreated);
  registerMetric(documentBundleSendRate);
  registered = true;
}
