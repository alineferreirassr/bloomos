"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useServiceEditor } from "@/modules/services/hooks/useServiceEditor";
import { useServiceCategories } from "@/modules/services/hooks/useServiceCategories";
import { useServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import { useUpdateService, useActivateService, useDeactivateService, useArchiveService, useRestoreService } from "@/modules/services/hooks/useServiceMutations";
import { useUpdateServiceVersionDraft, usePublishServiceVersion } from "@/modules/services/hooks/useServiceVersionMutations";
import { classifyThrownError } from "@/modules/services/hooks/errorContract";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { ServiceDetailHeader } from "@/modules/services/components/ServiceDetailHeader";
import { ServiceDetailTabs, isServiceDetailTabValue, type ServiceDetailTabValue } from "@/modules/services/components/ServiceDetailTabs";
import { ServiceArchivedBanner } from "@/modules/services/components/ServiceArchivedBanner";
import { ServiceOverviewTab } from "@/modules/services/components/ServiceOverviewTab";
import { ServiceComingSoonPanel } from "@/modules/services/components/ServicesStates";
import { TemplateBuilderPage } from "@/modules/services/components/TemplateBuilderPage";
import { HealthDashboardPage } from "@/modules/services/components/HealthDashboardPage";
import { VersionHistoryPage } from "@/modules/services/components/VersionHistoryPage";
import { ServiceAssignmentsPage } from "@/modules/services/components/ServiceAssignmentsPage";
import { ServiceDetailLoadingState } from "@/modules/services/components/ServiceDetailLoadingState";
import { ServiceDetailErrorState } from "@/modules/services/components/ServiceDetailErrorState";
import { PublishConfirmationDialog } from "@/modules/services/components/PublishConfirmationDialog";
import { Toast } from "@/components/ui/Toast";
import type { HealthNavigationTarget } from "@/modules/services/serviceHealthNavigation";
import type { TemplateCategoryKey } from "@/lib/queries/services/types";

const DEFAULT_TAB: ServiceDetailTabValue = "overview";

interface ServiceDetailPageProps {
  serviceId: string;
}

interface MutationLike {
  mutateAsync: (id: string) => Promise<unknown>;
}

/**
 * The one page every future Service Detail tab (Templates/Versions/Health,
 * built in later checkpoints) will extend — consumes only `useServiceEditor`
 * and the existing Service/draft-version mutation hooks, no Repository or
 * React Query import outside the hooks layer. Tab selection lives in the
 * URL's `?tab=` query param (never local state alone), so a direct link and
 * the browser's Back/Forward both land on the right panel.
 */
export function ServiceDetailPage({ serviceId }: ServiceDetailPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ServiceDetailTabValue = rawTab && isServiceDetailTabValue(rawTab) ? rawTab : DEFAULT_TAB;

  const setActiveTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === DEFAULT_TAB) params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const editor = useServiceEditor(serviceId);
  const categoriesQuery = useServiceCategories();
  const permissions = useServicesPermissions();

  const updateServiceMutation = useUpdateService(serviceId);
  const updateDraftMutation = useUpdateServiceVersionDraft(serviceId);
  const activateMutation = useActivateService();
  const deactivateMutation = useDeactivateService();
  const archiveMutation = useArchiveService();
  const restoreMutation = useRestoreService();
  const publishMutation = usePublishServiceVersion(serviceId, editor.data?.draftVersion.id ?? "");

  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const [publishedToastVersion, setPublishedToastVersion] = useState<number | null>(null);
  const [pendingScrollCategory, setPendingScrollCategory] = useState<TemplateCategoryKey | undefined>(undefined);

  function runStatusAction(mutation: MutationLike) {
    setStatusActionError(null);
    mutation.mutateAsync(serviceId).catch((error: unknown) => {
      setStatusActionError(classifyThrownError(error).message);
    });
  }

  function handleEditIdentity() {
    setActiveTab("overview");
    window.setTimeout(() => {
      document.getElementById("service-identity-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  /**
   * The one place a Health Dashboard issue's navigation actually lands —
   * switches tabs via the same URL-driven `setActiveTab` every other cross-tab
   * jump already uses. A `category` target defers its scroll to
   * `TemplateBuilderPage`'s own mount effect (which knows when its data is
   * actually ready); a plain tab target reuses `handleEditIdentity`'s
   * setTimeout-after-tab-switch pattern, since the Overview tab's content is
   * already loaded and only needs a render tick to mount.
   */
  function navigateToHealthTarget(target: HealthNavigationTarget) {
    setActiveTab(target.tab);
    if (target.category) {
      setPendingScrollCategory(target.category);
      return;
    }
    window.setTimeout(() => {
      document.getElementById("draft-version-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  if (editor.status === "pending") {
    return <ServiceDetailLoadingState />;
  }

  if (editor.status === "error") {
    return <ServiceDetailErrorState error={classifyThrownError(editor.error)} onRetry={() => editor.refetch()} />;
  }

  const { service, draftVersion, publishedVersion, health, recentTimeline, usageCount } = editor.data;
  const categories = categoriesQuery.data ?? [];
  const categoryName = categories.find((category) => category.id === service.category_id)?.name ?? null;
  const isArchived = service.status === "archived";

  const identityReadOnly = isArchived || !permissions.canEditIdentity;
  const draftReadOnly = isArchived || draftVersion.status !== "draft" || !permissions.canEditDraftVersion;
  const readOnlyReason = isArchived ? "Archived Services are read-only. Restore it first." : (permissions.disabledReason ?? undefined);

  return (
    <div className="space-y-4">
      <ServiceDetailHeader
        service={service}
        categoryName={categoryName}
        draftVersion={draftVersion}
        publishedVersion={publishedVersion}
        usageCount={usageCount}
        permissions={permissions}
        onEditIdentity={handleEditIdentity}
        onOpenPublish={() => setPublishDialogOpen(true)}
        onActivate={() => runStatusAction(activateMutation)}
        onDeactivate={() => runStatusAction(deactivateMutation)}
        onArchive={() => runStatusAction(archiveMutation)}
        onRestore={() => runStatusAction(restoreMutation)}
        activatePending={activateMutation.isPending}
        deactivatePending={deactivateMutation.isPending}
        archivePending={archiveMutation.isPending}
        restorePending={restoreMutation.isPending}
      />

      {statusActionError ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {statusActionError}
        </p>
      ) : null}

      {isArchived ? (
        <ServiceArchivedBanner
          onRestore={() => runStatusAction(restoreMutation)}
          restorePending={restoreMutation.isPending}
          restoreDisabled={!permissions.canArchiveRestore}
          restoreDisabledReason={permissions.disabledReason ?? undefined}
        />
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ServiceDetailTabs />

        <TabPanel value="overview" className="mt-4">
          <ServiceOverviewTab
            editor={{ service, draftVersion, publishedVersion, health, recentTimeline, usageCount }}
            categories={categories}
            onSaveIdentity={(input) => updateServiceMutation.mutateAsync(input)}
            onSaveDraftVersion={(input) => updateDraftMutation.mutateAsync(input)}
            identityReadOnly={identityReadOnly}
            draftReadOnly={draftReadOnly}
            readOnlyReason={readOnlyReason}
            onNavigateToTab={setActiveTab}
          />
        </TabPanel>
        <TabPanel value="templates" className="mt-4">
          <TemplateBuilderPage
            serviceId={service.id}
            serviceVersionId={draftVersion.id}
            isArchived={isArchived}
            canEdit={permissions.canEditDraftVersion}
            permissionDeniedReason={permissions.disabledReason ?? undefined}
            isPublishing={publishMutation.isPending}
            scrollToCategoryOnMount={pendingScrollCategory}
            onScrollHandled={() => setPendingScrollCategory(undefined)}
          />
        </TabPanel>
        <TabPanel value="versions" className="mt-4">
          <VersionHistoryPage serviceId={service.id} />
        </TabPanel>
        <TabPanel value="assignments" className="mt-4">
          <ServiceAssignmentsPage serviceId={service.id} />
        </TabPanel>
        <TabPanel value="health" className="mt-4">
          <HealthDashboardPage serviceId={service.id} onNavigate={navigateToHealthTarget} />
        </TabPanel>
        <TabPanel value="notes" className="mt-4">
          <ServiceComingSoonPanel label="Notes" />
        </TabPanel>
        <TabPanel value="timeline" className="mt-4">
          <ServiceComingSoonPanel label="Timeline" />
        </TabPanel>
      </Tabs>

      <PublishConfirmationDialog
        serviceId={serviceId}
        serviceName={service.name}
        liveDraftVersionUpdatedAt={draftVersion.updated_at}
        open={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        onConfirm={(input) => publishMutation.mutateAsync(input)}
        onPublished={(versionNumber) => setPublishedToastVersion(versionNumber)}
      />

      {publishedToastVersion != null ? (
        <Toast message={`Version ${publishedToastVersion} published successfully.`} onDismiss={() => setPublishedToastVersion(null)} />
      ) : null}
    </div>
  );
}
