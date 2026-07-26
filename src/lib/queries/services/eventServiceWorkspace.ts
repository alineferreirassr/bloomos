import {
  getEventService,
  getEventById,
  getClientById,
  getServiceVersion,
  listEventServiceInventoryRequirements,
  listEventServicePurchaseRequirements,
  listEventServiceBudgetLines,
  listEventServiceTeamRequirements,
  listEventServiceVendorAssignments,
  listEventServiceQuestionnaireResponses,
  listServiceQuestionnaireQuestions,
  getNotesByEventServiceId,
  getTimelineByEventServiceId,
} from "@/lib/data";
import type { EventServiceWorkspaceData } from "@/lib/queries/services/types";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { EventServicePurchaseRequirement } from "@/types/eventServicePurchaseRequirement";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";

interface FulfillmentInputs {
  inventory: EventServiceInventoryRequirement[];
  purchase: EventServicePurchaseRequirement[];
  team: EventServiceTeamRequirement[];
  vendor: EventServiceVendorAssignment[];
}

/**
 * Fulfillment/resolution is defined per requirement type, not a single
 * generic "is this row done" flag — each type's own resolved condition
 * mirrors the exact field the repository already uses to represent it:
 * inventory's own `is_fulfilled`, purchase's `fulfilled_purchase_id`,
 * team's `assigned_member_id`, vendor's `status !== "suggested"` (both
 * confirmed and declined count as resolved — the suggestion has been acted
 * on either way). Budget lines are informational estimates with no
 * completion concept and are deliberately excluded from the fulfillment
 * count, never coerced into a false "resolved"/"unresolved" state.
 *
 * This is an INSTANCE-level signal ("has this booking's generated work been
 * finished"), distinct from catalog Health ("is the blueprint complete") —
 * see health.ts's own doc comment for the other half of that distinction.
 *
 * Extracted as its own pure function so `getServiceAssignments` (the
 * Assignments list — one Service, many EventServices) can compute the same
 * "Completion" figure per row without re-fetching the heavier
 * questionnaire/notes/timeline data `getEventServiceWorkspace` also loads,
 * and without duplicating this formula a second time.
 */
export function computeFulfillmentSummary(inputs: FulfillmentInputs): { resolved: number; total: number } {
  const resolved =
    inputs.inventory.filter((r) => r.is_fulfilled).length +
    inputs.purchase.filter((r) => r.fulfilled_purchase_id !== null).length +
    inputs.team.filter((r) => r.assigned_member_id !== null).length +
    inputs.vendor.filter((r) => r.status !== "suggested").length;
  const total = inputs.inventory.length + inputs.purchase.length + inputs.team.length + inputs.vendor.length;
  return { resolved, total };
}

export async function getEventServiceWorkspace(eventServiceId: string): Promise<EventServiceWorkspaceData> {
  const eventService = await getEventService(eventServiceId);
  const event = await getEventById(eventService.event_id);

  const [client, version, inventory, purchase, budget, team, vendor, responses, questions, notes, timeline] = await Promise.all([
    getClientById(event.client_id),
    getServiceVersion(eventService.service_version_id),
    listEventServiceInventoryRequirements(eventServiceId),
    listEventServicePurchaseRequirements(eventServiceId),
    listEventServiceBudgetLines(eventServiceId),
    listEventServiceTeamRequirements(eventServiceId),
    listEventServiceVendorAssignments(eventServiceId),
    listEventServiceQuestionnaireResponses(eventServiceId),
    listServiceQuestionnaireQuestions(eventService.service_version_id),
    getNotesByEventServiceId(eventServiceId),
    getTimelineByEventServiceId(eventServiceId),
  ]);

  const responseByQuestionId = new Map(responses.map((response) => [response.question_id, response]));

  return {
    eventService,
    event,
    client,
    version,
    isNameOverridden: eventService.name !== eventService.name_template_value,
    isPriceOverridden: eventService.price_minor !== eventService.price_template_value,
    requirements: { inventory, purchase, budget, team, vendor },
    fulfillmentSummary: computeFulfillmentSummary({ inventory, purchase, team, vendor }),
    questionnaire: questions.map((question) => ({ question, response: responseByQuestionId.get(question.id) ?? null })),
    notes,
    timeline,
  };
}
