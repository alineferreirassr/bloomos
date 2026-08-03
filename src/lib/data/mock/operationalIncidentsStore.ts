import type { OperationalIncident, IncidentStatus, OperationalSeverity } from "@/types/operationsCenter";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 31 — Operational Incident persistence. Groups one or more `OperationalAlert`s; keeps its own, deliberately smaller lifecycle (`open`/`acknowledged`/`resolved`) than an Alert's own 6-state one, since an incident is a human-managed grouping, not an auto-detected condition. */
let incidents: OperationalIncident[] = [];

export function resetOperationalIncidentsStore(): void {
  incidents = [];
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  severity: OperationalSeverity;
  source_alert_ids: string[];
  related_dispatch_order_ids: string[];
  related_field_operation_ids: string[];
  related_route_plan_ids: string[];
  related_worker_ids: string[];
  related_vehicle_ids: string[];
  related_equipment_ids: string[];
  owner_member_id: string | null;
}

async function listIncidentsForWorkspace(workspaceId: string, includeResolved = false): Promise<OperationalIncident[]> {
  return incidents.filter((i) => i.workspace_id === workspaceId && (includeResolved || i.status !== "resolved"));
}

async function getIncidentById(id: string): Promise<OperationalIncident | null> {
  return incidents.find((i) => i.id === id) ?? null;
}

async function createIncident(workspaceId: string, input: CreateIncidentInput): Promise<DataResult<OperationalIncident>> {
  const timestamp = nowIso();
  const created: OperationalIncident = {
    id: generateId("operational_incident"),
    workspace_id: workspaceId,
    title: input.title,
    description: input.description,
    severity: input.severity,
    status: "open",
    source_alert_ids: input.source_alert_ids,
    related_dispatch_order_ids: input.related_dispatch_order_ids,
    related_field_operation_ids: input.related_field_operation_ids,
    related_route_plan_ids: input.related_route_plan_ids,
    related_worker_ids: input.related_worker_ids,
    related_vehicle_ids: input.related_vehicle_ids,
    related_equipment_ids: input.related_equipment_ids,
    owner_member_id: input.owner_member_id,
    resolution_notes: null,
    created_at: timestamp,
    acknowledged_at: null,
    resolved_at: null,
    updated_at: timestamp,
  };
  incidents = [...incidents, created];
  return ok(created);
}

async function setIncidentStatus(id: string, workspaceId: string, status: IncidentStatus, resolutionNotes: string | null = null): Promise<DataResult<OperationalIncident>> {
  const existing = incidents.find((i) => i.id === id && i.workspace_id === workspaceId);
  if (!existing) return fail("This incident could not be found.");
  const timestamp = nowIso();
  const updated: OperationalIncident = {
    ...existing,
    status,
    acknowledged_at: status === "acknowledged" ? timestamp : existing.acknowledged_at,
    resolved_at: status === "resolved" ? timestamp : existing.resolved_at,
    resolution_notes: status === "resolved" ? (resolutionNotes ?? existing.resolution_notes) : existing.resolution_notes,
    updated_at: timestamp,
  };
  incidents = incidents.map((i) => (i.id === id ? updated : i));
  return ok(updated);
}

async function addAlertToIncident(id: string, workspaceId: string, alertId: string): Promise<DataResult<OperationalIncident>> {
  const existing = incidents.find((i) => i.id === id && i.workspace_id === workspaceId);
  if (!existing) return fail("This incident could not be found.");
  if (existing.source_alert_ids.includes(alertId)) return ok(existing);
  const updated: OperationalIncident = { ...existing, source_alert_ids: [...existing.source_alert_ids, alertId], updated_at: nowIso() };
  incidents = incidents.map((i) => (i.id === id ? updated : i));
  return ok(updated);
}

export interface OperationalIncidentsRepository {
  listIncidentsForWorkspace: typeof listIncidentsForWorkspace;
  getIncidentById: typeof getIncidentById;
  createIncident: typeof createIncident;
  setIncidentStatus: typeof setIncidentStatus;
  addAlertToIncident: typeof addAlertToIncident;
}

export const mockOperationalIncidentsRepository: OperationalIncidentsRepository = {
  listIncidentsForWorkspace,
  getIncidentById,
  createIncident,
  setIncidentStatus,
  addAlertToIncident,
};
