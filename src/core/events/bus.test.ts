import { describe, expect, it, vi, beforeEach } from "vitest";
import { subscribeToDomainEvent, publishDomainEvent, resetDomainEventBus } from "@/core/events/bus";

describe("domain event bus", () => {
  beforeEach(() => {
    resetDomainEventBus();
  });

  it("delivers a published event to a subscribed handler", async () => {
    const handler = vi.fn();
    subscribeToDomainEvent("checklist.overdue", handler);

    const event = { type: "checklist.overdue", payload: { itemId: "item_1" }, workspaceId: "ws_a", occurredAt: "2026-07-25T00:00:00.000Z" };
    await publishDomainEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it("does nothing when no one is subscribed to that event type", async () => {
    await expect(
      publishDomainEvent({ type: "nobody.listening", payload: {}, workspaceId: "ws_a", occurredAt: "2026-07-25T00:00:00.000Z" }),
    ).resolves.toBeUndefined();
  });

  it("delivers to every subscriber, not just the first", async () => {
    const first = vi.fn();
    const second = vi.fn();
    subscribeToDomainEvent("invoice.deposit_due", first);
    subscribeToDomainEvent("invoice.deposit_due", second);

    await publishDomainEvent({ type: "invoice.deposit_due", payload: {}, workspaceId: "ws_a", occurredAt: "2026-07-25T00:00:00.000Z" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops delivering to a handler after it unsubscribes", async () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToDomainEvent("checklist.overdue", handler);
    unsubscribe();

    await publishDomainEvent({ type: "checklist.overdue", payload: {}, workspaceId: "ws_a", occurredAt: "2026-07-25T00:00:00.000Z" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("awaits an async handler before publishDomainEvent resolves", async () => {
    let resolved = false;
    subscribeToDomainEvent("slow.event", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      resolved = true;
    });

    await publishDomainEvent({ type: "slow.event", payload: {}, workspaceId: "ws_a", occurredAt: "2026-07-25T00:00:00.000Z" });
    expect(resolved).toBe(true);
  });
});
