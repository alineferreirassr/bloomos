import { getService, getServiceVersion, listServiceVersions, getTimelineByServiceId, getServiceUsageCounts } from "@/lib/data";
import { computeNextServiceVersionNumber, canPublishServiceVersion } from "@/core/workflows/serviceWorkflow";
import { getServiceHealth } from "@/lib/queries/services/health";
import { getTemplateBuilder } from "@/lib/queries/services/templateBuilder";
import { computeTemplateCompletion } from "@/lib/queries/services/templateCompletion";
import type { ServiceEditorData, VersionHistoryResult, PublishPreview } from "@/lib/queries/services/types";

const RECENT_TIMELINE_LIMIT = 10;

export async function getServiceEditor(serviceId: string): Promise<ServiceEditorData> {
  const service = await getService(serviceId);
  if (!service.draft_version_id) {
    throw new Error(`Service ${serviceId} has no draft version.`);
  }

  const [draftVersion, publishedVersion, health, timeline, usageCounts] = await Promise.all([
    getServiceVersion(service.draft_version_id),
    service.current_published_version_id ? getServiceVersion(service.current_published_version_id) : Promise.resolve(null),
    getServiceHealth(serviceId),
    getTimelineByServiceId(serviceId),
    // A single-id batch call — still the one, only entry point for usage
    // data, never a bespoke "get usage for one Service" method.
    getServiceUsageCounts([serviceId]),
  ]);

  return {
    service,
    draftVersion,
    publishedVersion,
    health,
    recentTimeline: timeline.slice(0, RECENT_TIMELINE_LIMIT),
    usageCount: usageCounts[serviceId] ?? 0,
  };
}

export async function getVersionHistory(serviceId: string): Promise<VersionHistoryResult> {
  const [service, versions] = await Promise.all([getService(serviceId), listServiceVersions(serviceId)]);
  return {
    service,
    rows: versions.map((version) => ({ version, isCurrentDraft: version.id === service.draft_version_id })),
  };
}

/**
 * Everything the Publish Confirmation dialog needs, composed once here —
 * the dialog never recomputes readiness, it only renders this. `warnings`
 * is sourced entirely from `health.missing` (already the one place
 * "usually expected but missing" is decided); `templateCompletion` is a
 * separate, purely display metric mirroring what the Template Builder tab
 * already shows, not an independent warnings generator, so nothing is
 * ever reported twice under two different names.
 */
export async function getPublishPreview(serviceId: string): Promise<PublishPreview> {
  const service = await getService(serviceId);
  if (!service.draft_version_id) {
    throw new Error(`Service ${serviceId} has no draft version.`);
  }

  const [draft, versions, health, builder] = await Promise.all([
    getServiceVersion(service.draft_version_id),
    listServiceVersions(serviceId),
    getServiceHealth(serviceId),
    getTemplateBuilder(service.draft_version_id),
  ]);

  const blockingReason = canPublishServiceVersion(draft);
  const nextVersionNumber = computeNextServiceVersionNumber(versions.map((version) => version.version_number));
  const currentPublishedVersionNumber = service.current_published_version_id
    ? (versions.find((version) => version.id === service.current_published_version_id)?.version_number ?? null)
    : null;

  const templateCompletion = computeTemplateCompletion(builder);
  const affectedCategories = builder.groups.flatMap((group) => group.categories.filter((category) => category.count > 0).map((category) => category.key));
  const warnings = health.missing.map((item) => `${item.label} is missing or incomplete.`);

  return {
    serviceId,
    draftVersionId: draft.id,
    draftVersionUpdatedAt: draft.updated_at,
    nextVersionNumber,
    currentPublishedVersionNumber,
    health,
    templateCompletion,
    affectedCategories,
    blockingErrors: blockingReason ? [blockingReason] : [],
    warnings,
    canPublish: blockingReason === null,
  };
}
