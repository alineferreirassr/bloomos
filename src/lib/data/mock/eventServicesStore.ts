import type { EventService } from "@/types/eventService";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { EventServicePurchaseRequirement } from "@/types/eventServicePurchaseRequirement";
import type { EventServiceBudgetLine } from "@/types/eventServiceBudgetLine";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceQuestionnaireResponse } from "@/types/eventServiceQuestionnaireResponse";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";

/**
 * The Instance layer: one seeded EventService (Photography, pinned to
 * service_version_photography_v1, assigned to event_1) plus the full set of
 * generated child rows buildEventServiceAssignmentPlan would have produced
 * for it — demonstrates the complete assign-then-generate flow without
 * requiring a live assignService call just to see realistic data.
 */
const SEED_EVENT_SERVICES: EventService[] = [
  {
    id: "event_service_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    event_id: "event_1",
    service_id: "service_photography",
    service_version_id: "service_version_photography_v1",
    name: "Photography",
    name_template_value: "Photography",
    price_minor: 150000,
    price_template_value: 150000,
    currency: "USD",
    selected_add_on_ids: [],
    status: "confirmed",
    assigned_at: "2026-07-13T09:00:00.000Z",
    assigned_by: CURRENT_ACTOR,
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
  },
];

const SEED_INVENTORY_REQUIREMENTS: EventServiceInventoryRequirement[] = [
  {
    id: "event_service_inventory_requirement_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: "event_service_1",
    inventory_item_id: null,
    item_name: "Reflector kit",
    quantity: 1,
    is_fulfilled: false,
    note: null,
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
  },
];

const SEED_PURCHASE_REQUIREMENTS: EventServicePurchaseRequirement[] = [
  {
    id: "event_service_purchase_requirement_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: "event_service_1",
    item_name: "Memory cards",
    estimated_unit_cost_minor: 4000,
    estimated_quantity: 2,
    typical_vendor_id: null,
    fulfilled_purchase_id: null,
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
  },
];

const SEED_BUDGET_LINES: EventServiceBudgetLine[] = [
  {
    id: "event_service_budget_line_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: "event_service_1",
    label: "Photography package",
    category: "photography",
    estimated_revenue_minor: 150000,
    estimated_cost_minor: 90000,
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
  },
];

const SEED_TEAM_REQUIREMENTS: EventServiceTeamRequirement[] = [
  {
    id: "event_service_team_requirement_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: "event_service_1",
    role_label: "Lead Photographer",
    quantity: 1,
    note: null,
    assigned_member_id: null,
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
  },
];

const SEED_VENDOR_ASSIGNMENTS: EventServiceVendorAssignment[] = [
  {
    id: "event_service_vendor_assignment_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: "event_service_1",
    vendor_id: "vendor_1",
    status: "suggested",
    note: "Preferred photography partner.",
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
  },
];

const SEED_QUESTIONNAIRE_RESPONSES: EventServiceQuestionnaireResponse[] = [
  {
    id: "event_service_questionnaire_response_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    event_service_id: "event_service_1",
    question_id: "sqq_1",
    response_text: "Golden hour shots of the proposal moment.",
    response_options: null,
    response_boolean: null,
    response_date: null,
    created_at: "2026-07-13T09:00:00.000Z",
    updated_at: "2026-07-13T09:00:00.000Z",
  },
];

let eventServices: EventService[] = SEED_EVENT_SERVICES.map((r) => ({ ...r }));
let inventoryRequirements: EventServiceInventoryRequirement[] = SEED_INVENTORY_REQUIREMENTS.map((r) => ({ ...r }));
let purchaseRequirements: EventServicePurchaseRequirement[] = SEED_PURCHASE_REQUIREMENTS.map((r) => ({ ...r }));
let budgetLines: EventServiceBudgetLine[] = SEED_BUDGET_LINES.map((r) => ({ ...r }));
let teamRequirements: EventServiceTeamRequirement[] = SEED_TEAM_REQUIREMENTS.map((r) => ({ ...r }));
let vendorAssignments: EventServiceVendorAssignment[] = SEED_VENDOR_ASSIGNMENTS.map((r) => ({ ...r }));
let questionnaireResponses: EventServiceQuestionnaireResponse[] = SEED_QUESTIONNAIRE_RESPONSES.map((r) => ({ ...r }));

export function readEventServices(): EventService[] {
  return eventServices;
}
export function writeEventServices(next: EventService[]): void {
  eventServices = next;
}

export function readEventServiceInventoryRequirements(): EventServiceInventoryRequirement[] {
  return inventoryRequirements;
}
export function writeEventServiceInventoryRequirements(next: EventServiceInventoryRequirement[]): void {
  inventoryRequirements = next;
}

export function readEventServicePurchaseRequirements(): EventServicePurchaseRequirement[] {
  return purchaseRequirements;
}
export function writeEventServicePurchaseRequirements(next: EventServicePurchaseRequirement[]): void {
  purchaseRequirements = next;
}

export function readEventServiceBudgetLines(): EventServiceBudgetLine[] {
  return budgetLines;
}
export function writeEventServiceBudgetLines(next: EventServiceBudgetLine[]): void {
  budgetLines = next;
}

export function readEventServiceTeamRequirements(): EventServiceTeamRequirement[] {
  return teamRequirements;
}
export function writeEventServiceTeamRequirements(next: EventServiceTeamRequirement[]): void {
  teamRequirements = next;
}

export function readEventServiceVendorAssignments(): EventServiceVendorAssignment[] {
  return vendorAssignments;
}
export function writeEventServiceVendorAssignments(next: EventServiceVendorAssignment[]): void {
  vendorAssignments = next;
}

export function readEventServiceQuestionnaireResponses(): EventServiceQuestionnaireResponse[] {
  return questionnaireResponses;
}
export function writeEventServiceQuestionnaireResponses(next: EventServiceQuestionnaireResponse[]): void {
  questionnaireResponses = next;
}

/** Test-only: restore every Instance-layer store to its seeded state between test cases. */
export function resetEventServicesStore(): void {
  eventServices = SEED_EVENT_SERVICES.map((r) => ({ ...r }));
  inventoryRequirements = SEED_INVENTORY_REQUIREMENTS.map((r) => ({ ...r }));
  purchaseRequirements = SEED_PURCHASE_REQUIREMENTS.map((r) => ({ ...r }));
  budgetLines = SEED_BUDGET_LINES.map((r) => ({ ...r }));
  teamRequirements = SEED_TEAM_REQUIREMENTS.map((r) => ({ ...r }));
  vendorAssignments = SEED_VENDOR_ASSIGNMENTS.map((r) => ({ ...r }));
  questionnaireResponses = SEED_QUESTIONNAIRE_RESPONSES.map((r) => ({ ...r }));
}
