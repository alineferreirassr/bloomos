export type WorkflowErrorAcknowledgementStatus = "open" | "ignored" | "archived";

/** executionId::actionId -> status. Mirrors the `approvalOverrides` mock store shape in `lib/data/core/automation/mockRepository.ts` — a plain in-memory map, reset between tests. */
let acknowledgements = new Map<string, WorkflowErrorAcknowledgementStatus>();

function key(executionId: string, actionId: string): string {
  return `${executionId}::${actionId}`;
}

export function resetWorkflowErrorAcknowledgements(): void {
  acknowledgements = new Map();
}

export function getWorkflowErrorAcknowledgement(executionId: string, actionId: string): WorkflowErrorAcknowledgementStatus {
  return acknowledgements.get(key(executionId, actionId)) ?? "open";
}

export function setWorkflowErrorAcknowledgement(executionId: string, actionId: string, status: WorkflowErrorAcknowledgementStatus): void {
  acknowledgements.set(key(executionId, actionId), status);
}
