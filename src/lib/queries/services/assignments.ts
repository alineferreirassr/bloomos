import {
  getService,
  listEventServicesByService,
  listServiceVersions,
  getEventById,
  getClientById,
  listEventServiceInventoryRequirements,
  listEventServicePurchaseRequirements,
  listEventServiceTeamRequirements,
  listEventServiceVendorAssignments,
} from "@/lib/data";
import { computeFulfillmentSummary } from "@/lib/queries/services/eventServiceWorkspace";
import type { ServiceAssignmentRow, ServiceAssignmentsResult } from "@/lib/queries/services/types";
import type { EventService } from "@/types/eventService";

/**
 * Every row needs only the four requirement lists that feed "Completion"/
 * "Assigned team" — never the full `EventServiceWorkspaceData` (which also
 * loads budget lines, questionnaire responses, notes, and timeline). That
 * heavier read stays reserved for `useEventServiceWorkspace`, called lazily
 * once a single assignment is selected in the detail panel — fetching it
 * for every row up front would mean loading data most rows never display.
 */
async function buildAssignmentRow(eventService: EventService, versionNumberById: Map<string, number | null>): Promise<ServiceAssignmentRow> {
  const [event, inventory, purchase, team, vendor] = await Promise.all([
    getEventById(eventService.event_id),
    listEventServiceInventoryRequirements(eventService.id),
    listEventServicePurchaseRequirements(eventService.id),
    listEventServiceTeamRequirements(eventService.id),
    listEventServiceVendorAssignments(eventService.id),
  ]);
  const client = await getClientById(event.client_id);

  return {
    eventService,
    event,
    client,
    versionNumber: versionNumberById.get(eventService.service_version_id) ?? null,
    isNameOverridden: eventService.name !== eventService.name_template_value,
    isPriceOverridden: eventService.price_minor !== eventService.price_template_value,
    team: { resolved: team.filter((requirement) => requirement.assigned_member_id !== null).length, total: team.length },
    completion: computeFulfillmentSummary({ inventory, purchase, team, vendor }),
  };
}

/**
 * The Event Assignment tab's one data source. Ordering is left to the
 * caller (`ServiceAssignmentsPage` sorts newest-Event-first) — this just
 * composes the full, unsorted, unfiltered set of rows so every filter the
 * UI offers stays a pure client-side operation over data already in hand.
 */
export async function getServiceAssignments(serviceId: string): Promise<ServiceAssignmentsResult> {
  const [service, eventServices, versions] = await Promise.all([
    getService(serviceId),
    listEventServicesByService(serviceId),
    listServiceVersions(serviceId),
  ]);

  const versionNumberById = new Map(versions.map((version) => [version.id, version.version_number]));
  const rows = await Promise.all(eventServices.map((eventService) => buildAssignmentRow(eventService, versionNumberById)));

  return { service, rows };
}
