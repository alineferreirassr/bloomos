import type { DomainEvent, DomainEventHandler } from "@/core/events/types";

/**
 * A minimal, synchronous, in-process pub/sub — the "Event bus integration"
 * point later checkpoints' Automation Engine and Smart Notifications will
 * subscribe to. Nothing publishes a real domain event yet (that's business
 * logic, out of scope this checkpoint); this is the wiring a future
 * `publishDomainEvent("checklist.overdue", ...)` call slots into without
 * any subscriber-side code changing.
 *
 * Deliberately in-memory and per-process, not a real message broker — a
 * background-job runner (Phase 3) is what would make this durable/
 * cross-process; this bus's job is only to decouple "something happened"
 * from "something reacts," not to survive a server restart.
 */
const subscribers = new Map<string, Set<DomainEventHandler>>();

/** Returns an unsubscribe function, matching the DOM/React convention for cleanup. */
export function subscribeToDomainEvent<TPayload = unknown>(type: string, handler: DomainEventHandler<TPayload>): () => void {
  const handlers = subscribers.get(type) ?? new Set<DomainEventHandler>();
  handlers.add(handler as DomainEventHandler);
  subscribers.set(type, handlers);

  return () => {
    handlers.delete(handler as DomainEventHandler);
  };
}

/** Awaits every subscriber in registration order — a slow handler delays publication rather than being silently dropped, matching this codebase's "no fire-and-forget on anything that matters" posture. */
export async function publishDomainEvent<TPayload = unknown>(event: DomainEvent<TPayload>): Promise<void> {
  const handlers = subscribers.get(event.type);
  if (!handlers) return;

  for (const handler of handlers) {
    await handler(event);
  }
}

/** Test-only: restore the bus to empty between test cases. */
export function resetDomainEventBus(): void {
  subscribers.clear();
}
