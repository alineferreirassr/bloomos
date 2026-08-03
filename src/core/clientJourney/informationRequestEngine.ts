import type { ClientInformationRequest, InformationRequestStatus } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Information Request Engine (Step 15 support). Pure
 * helpers over `ClientInformationRequest` — no I/O, no external forms/
 * email/SMS provider. The persisted store (`clientInformationRequestsStore.ts`)
 * owns creation/status writes; this engine owns the read-only derivations
 * every caller (module layer, Dashboard, Client Portal) needs in common.
 */

/** A request reads as overdue only by comparing its own `dueDate` against `now` — never a stored flag that could drift out of date. */
export function isRequestOverdue(request: ClientInformationRequest, now: string): boolean {
  return request.status === "pending" && request.dueDate !== null && request.dueDate < now;
}

export function effectiveStatus(request: ClientInformationRequest, now: string): InformationRequestStatus {
  return isRequestOverdue(request, now) ? "overdue" : request.status;
}

export function summarizeRequests(requests: ClientInformationRequest[], now: string): { pending: number; overdue: number; fulfilled: number; cancelled: number } {
  let pending = 0;
  let overdue = 0;
  let fulfilled = 0;
  let cancelled = 0;
  for (const request of requests) {
    const status = effectiveStatus(request, now);
    if (status === "overdue") overdue += 1;
    else if (status === "pending") pending += 1;
    else if (status === "fulfilled") fulfilled += 1;
    else if (status === "cancelled") cancelled += 1;
  }
  return { pending, overdue, fulfilled, cancelled };
}

/** Portal-safe projection — strips `internalNotes`, the one field Step 26 (Privacy) names as internal-only. */
export interface ClientFacingInformationRequest {
  id: string;
  title: string;
  description: string;
  requiredFields: string[];
  requiredDocuments: string[];
  dueDate: string | null;
  status: InformationRequestStatus;
  clientResponse: string | null;
}

export function toClientFacing(request: ClientInformationRequest, now: string): ClientFacingInformationRequest {
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    requiredFields: request.requiredFields,
    requiredDocuments: request.requiredDocuments,
    dueDate: request.dueDate,
    status: effectiveStatus(request, now),
    clientResponse: request.clientResponse,
  };
}
