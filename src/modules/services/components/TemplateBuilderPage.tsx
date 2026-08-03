"use client";

import { useEffect } from "react";
import { useTemplateBuilder } from "@/modules/services/hooks/useTemplateBuilder";
import { TemplateBuilderLoadingState } from "@/modules/services/components/TemplateBuilderLoadingState";
import { TemplateBuilderEmptyState } from "@/modules/services/components/TemplateBuilderEmptyState";
import { TemplateBuilderSidebar } from "@/modules/services/components/TemplateBuilderSidebar";
import { TemplateCategorySection } from "@/modules/services/components/TemplateCategorySection";
import { ErrorState } from "@/components/ui/ErrorState";
import { ALL_TEMPLATE_CATEGORY_ADAPTERS } from "@/modules/services/templateCategoryAdapters";
import type { TemplateCategoryData, TemplateCategoryKey } from "@/lib/queries/services/types";

interface TemplateBuilderPageProps {
  serviceId: string;
  serviceVersionId: string;
  /** Service.status === "archived" — computed by the caller (ServiceDetailPage), never re-derived here. */
  isArchived: boolean;
  /** From useServicesPermissions() — the same adapter seam every other Service Detail editing surface already uses. */
  canEdit: boolean;
  permissionDeniedReason?: string;
  /**
   * True only for the brief window the publish mutation is in flight — the
   * RPC clones this exact draft's rows into a new version as part of
   * publishing, so edits during that window could race the clone. Distinct
   * from `locked` (a published version, permanent) — this is transient and
   * always false again once the mutation settles.
   */
  isPublishing?: boolean;
  /** Set when arriving here from another tab (e.g. the Health Dashboard's "Fix now" action) that wants a specific category scrolled into view once the data is ready. */
  scrollToCategoryOnMount?: TemplateCategoryKey;
  /** Called once the requested scroll has happened, so the caller can clear its pending-navigation state and this effect doesn't re-fire on every render. */
  onScrollHandled?: () => void;
}

/**
 * The canonical editor for every ServiceVersion template category — reads
 * only `useTemplateBuilder(serviceVersionId)` plus the existing template
 * mutation hooks (reached through each adapter, never imported directly
 * here). `isEditable` (published-version lock) comes straight from the
 * query response; `isArchived`/`canEdit` are the two additional read-only
 * gates every other Service Detail surface already applies, composed here
 * the same way.
 */
export function TemplateBuilderPage({
  serviceId,
  serviceVersionId,
  isArchived,
  canEdit,
  permissionDeniedReason,
  isPublishing = false,
  scrollToCategoryOnMount,
  onScrollHandled,
}: TemplateBuilderPageProps) {
  const query = useTemplateBuilder(serviceVersionId);

  useEffect(() => {
    if (!scrollToCategoryOnMount || query.status !== "success") return;
    document.getElementById(`template-category-${scrollToCategoryOnMount}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    onScrollHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToCategoryOnMount, query.status]);

  if (query.status === "pending") {
    return <TemplateBuilderLoadingState />;
  }

  if (query.status === "error") {
    return <ErrorState message="We couldn't load the Template Builder." onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  const locked = !data.isEditable;
  const disabled = isArchived || !canEdit || isPublishing;
  const disabledReason = isArchived
    ? "Archived Services are read-only. Restore it first."
    : isPublishing
      ? "Publishing in progress — please wait."
      : locked
        ? "This version is published and can no longer be edited."
        : !canEdit
          ? permissionDeniedReason
          : undefined;

  const totalItems = data.groups.reduce((sum, group) => sum + group.categories.reduce((groupSum, category) => groupSum + category.count, 0), 0);

  function scrollToCategory(key: TemplateCategoryKey) {
    document.getElementById(`template-category-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {totalItems === 0 ? <TemplateBuilderEmptyState /> : null}
        {data.groups.map((group) => (
          <div key={group.groupName} className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-text-muted uppercase">{group.groupName}</h3>
            <div className="space-y-3">
              {group.categories.map((category) => {
                const adapter = ALL_TEMPLATE_CATEGORY_ADAPTERS.find((candidate) => candidate.key === category.key);
                if (!adapter) return null;
                return (
                  <div key={category.key} id={`template-category-${category.key}`}>
                    <TemplateCategorySection
                      adapter={adapter}
                      category={category as unknown as TemplateCategoryData<{ id: string; display_order?: number }>}
                      serviceId={serviceId}
                      serviceVersionId={serviceVersionId}
                      disabled={disabled}
                      locked={locked}
                      disabledReason={disabledReason}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div>
        <TemplateBuilderSidebar data={data} adapters={ALL_TEMPLATE_CATEGORY_ADAPTERS} onNavigateToCategory={scrollToCategory} />
      </div>
    </div>
  );
}
