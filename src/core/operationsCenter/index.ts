import { mockOperationalAlertsRepository } from "@/lib/data/mock/operationalAlertsStore";
import { mockOperationalIncidentsRepository } from "@/lib/data/mock/operationalIncidentsStore";

export type { OperationalAlert, AlertStatus, OperationalIncident, IncidentStatus } from "@/types/operationsCenter";
export type { OperationalAlertsRepository } from "@/lib/data/mock/operationalAlertsStore";
export type { CreateIncidentInput, OperationalIncidentsRepository } from "@/lib/data/mock/operationalIncidentsStore";

/** v2.0 Checkpoint 31 — Mock-only accessors, same precedent as every prior checkpoint's own `core/<domain>/index.ts`. No Supabase table exists yet for either Alert or Incident. */
export function getCoreOperationalAlertsService() {
  return mockOperationalAlertsRepository;
}

export function getCoreOperationalIncidentsService() {
  return mockOperationalIncidentsRepository;
}
