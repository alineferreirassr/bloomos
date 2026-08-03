/**
 * Something that happened in a Workspace, decoupled from who (if anyone)
 * reacts to it. `type` is a free-form, dot-namespaced string (e.g.
 * "checklist.overdue", "invoice.deposit_due") rather than a closed enum —
 * modules will keep adding event types long after this bus itself stops
 * changing, the same "curated free text, not a canonical enum" call this
 * codebase already made for `Client.source`/`category`.
 */
export interface DomainEvent<TPayload = unknown> {
  type: string;
  payload: TPayload;
  workspaceId: string;
  occurredAt: string;
}

export type DomainEventHandler<TPayload = unknown> = (event: DomainEvent<TPayload>) => void | Promise<void>;
