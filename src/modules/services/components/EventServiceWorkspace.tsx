"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { useEventServiceWorkspace } from "@/modules/services/hooks/useEventServiceWorkspace";
import { useEventServiceChecklist } from "@/modules/services/hooks/useEventServiceChecklist";
import { classifyThrownError } from "@/modules/services/hooks/errorContract";
import { WorkspaceHeader } from "@/modules/services/components/WorkspaceHeader";
import { WorkspaceActions } from "@/modules/services/components/WorkspaceActions";
import { AssignmentSummaryCard } from "@/modules/services/components/AssignmentSummaryCard";
import { AssignmentOverridesCard } from "@/modules/services/components/AssignmentOverridesCard";
import { AssignmentTeamCard } from "@/modules/services/components/AssignmentTeamCard";
import { AssignmentTimelineCard } from "@/modules/services/components/AssignmentTimelineCard";
import { ClientSection } from "@/modules/services/components/ClientSection";
import { ServiceVersionSection } from "@/modules/services/components/ServiceVersionSection";
import { InventorySection } from "@/modules/services/components/InventorySection";
import { TemplateProgressSection } from "@/modules/services/components/TemplateProgressSection";
import { TemplateExecutionSection } from "@/modules/services/components/TemplateExecutionSection";
import { EventServiceNotesSection } from "@/modules/services/components/EventServiceNotesSection";
import { ActivitySection } from "@/modules/services/components/ActivitySection";
import { EventServiceAttachmentsSection } from "@/modules/services/components/EventServiceAttachmentsSection";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";
import type { EventServiceWorkspaceData } from "@/lib/queries/services/types";

interface EventServiceWorkspaceProps {
  serviceId: string;
  eventServiceId: string;
}

const WORKSPACE_TABS = ["overview", "execution", "timeline", "notes", "attachments"] as const;
type WorkspaceTab = (typeof WORKSPACE_TABS)[number];
const DEFAULT_TAB: WorkspaceTab = "overview";

function isWorkspaceTab(value: string): value is WorkspaceTab {
  return (WORKSPACE_TABS as readonly string[]).includes(value);
}

/**
 * `AssignmentSummaryCard` expects the Assignments-table row shape
 * (`ServiceAssignmentRow`), not `EventServiceWorkspaceData` — this adapts
 * one into the other purely by re-deriving the same two aggregate fields
 * (`team`/`completion`) `getServiceAssignments` already computes for the
 * list view, using the exact same definitions (`computeFulfillmentSummary`
 * for `completion`, resolved-count/length for `team`). No new business
 * logic — just enough reshaping to reuse the card verbatim instead of
 * duplicating its JSX.
 */
function toAssignmentRow(data: EventServiceWorkspaceData): ServiceAssignmentRow {
  const { team } = data.requirements;
  return {
    eventService: data.eventService,
    event: data.event,
    client: data.client,
    versionNumber: data.version.version_number,
    isNameOverridden: data.isNameOverridden,
    isPriceOverridden: data.isPriceOverridden,
    team: { resolved: team.filter((requirement) => requirement.assigned_member_id !== null).length, total: team.length },
    completion: data.fulfillmentSummary,
  };
}

/**
 * This is NOT a redesign of `AssignmentDetailPanel` — that component keeps
 * working exactly as before for the Assignments tab's inline row preview.
 * This is the operational extension the checkpoint asked for: the same
 * cards (`AssignmentSummaryCard`/`AssignmentOverridesCard`/
 * `AssignmentTeamCard`/`AssignmentTimelineCard`) composed alongside new
 * sections into a full page, reachable via its own route from an "Open
 * Workspace" action rather than replacing the inline preview.
 */
export function EventServiceWorkspace({ serviceId, eventServiceId }: EventServiceWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("section");
  const activeTab: WorkspaceTab = rawTab && isWorkspaceTab(rawTab) ? rawTab : DEFAULT_TAB;

  const setActiveTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === DEFAULT_TAB) params.delete("section");
      else params.set("section", next);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const workspace = useEventServiceWorkspace(eventServiceId);
  const checklist = useEventServiceChecklist(eventServiceId, workspace.data?.event.id);

  if (workspace.status === "pending") {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (workspace.status === "error") {
    const classified = classifyThrownError(workspace.error);
    if (classified.kind === "not_found") {
      return <ErrorState message="This assignment doesn't exist, or has been permanently removed." />;
    }
    return <ErrorState message="We couldn't load this assignment's workspace." onRetry={() => workspace.refetch()} />;
  }

  const data = workspace.data;
  const row = toAssignmentRow(data);
  const checklistItems = checklist.data ?? [];

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="sr-only">
        Viewing workspace for {data.event.title}.
      </p>

      <WorkspaceHeader
        eventService={data.eventService}
        event={data.event}
        client={data.client}
        version={data.version}
        team={data.requirements.team}
        fulfillmentSummary={data.fulfillmentSummary}
        actions={
          <WorkspaceActions
            eventServiceId={eventServiceId}
            eventId={data.event.id}
            clientId={data.client.id}
            serviceId={serviceId}
            status={data.eventService.status}
          />
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabList aria-label="Workspace sections">
          <Tab value="overview">Overview</Tab>
          <Tab value="execution">Execution</Tab>
          <Tab value="timeline">Timeline</Tab>
          <Tab value="notes">Notes</Tab>
          <Tab value="attachments">Attachments</Tab>
        </TabList>

        <TabPanel value="overview" className="space-y-4 pt-4">
          <AssignmentSummaryCard row={row} />
          <ClientSection client={data.client} />
          <ServiceVersionSection version={data.version} checklistItems={checklistItems} />
          <AssignmentTeamCard team={data.requirements.team} />
          <InventorySection eventServiceId={eventServiceId} status={data.eventService.status} inventory={data.requirements.inventory} />
          <AssignmentOverridesCard eventService={data.eventService} serviceId={serviceId} />
          <ActivitySection activities={data.timeline} />
        </TabPanel>

        <TabPanel value="execution" className="space-y-4 pt-4">
          <TemplateProgressSection checklistItems={checklistItems} />
          <TemplateExecutionSection eventServiceId={eventServiceId} status={data.eventService.status} checklistItems={checklistItems} />
        </TabPanel>

        <TabPanel value="timeline" className="pt-4">
          <AssignmentTimelineCard activities={data.timeline} />
        </TabPanel>

        <TabPanel value="notes" className="pt-4">
          <EventServiceNotesSection
            workspaceId={data.eventService.workspace_id}
            eventServiceId={eventServiceId}
            status={data.eventService.status}
            notes={data.notes}
          />
        </TabPanel>

        <TabPanel value="attachments" className="pt-4">
          <EventServiceAttachmentsSection eventServiceId={eventServiceId} status={data.eventService.status} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
