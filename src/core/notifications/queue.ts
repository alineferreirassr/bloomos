import type { NotificationChannel } from "@/core/notifications/types";

export interface NotificationQueueItem {
  channel: NotificationChannel;
  /** v2 Checkpoint 44, Step 6 — exactly one of `recipientMemberId` / `recipientClientAccountId` is set, mirroring `NotificationDeliveryRequest`'s own widened contract. */
  recipientMemberId?: string;
  recipientClientAccountId?: string;
  title: string;
  body: string;
}

/**
 * Dependency inversion for *when* a notification is delivered, separate
 * from `NotificationProvider` (*how*). Enqueuing today is synchronous and
 * in-memory (`inMemoryNotificationQueue`) — a real implementation (backed
 * by Phase 3's Background Jobs) would actually defer/batch/retry delivery;
 * the interface is what lets that swap happen without any caller changing,
 * same pattern as every other provider seam in `core/`.
 */
export interface NotificationQueue {
  enqueue(item: NotificationQueueItem): Promise<void>;
}

/**
 * The default queue — holds items in memory so a caller has something real
 * to enqueue into today, without pretending any durable delivery exists
 * yet. `drain()` is how a future worker (or a test) reads and clears it.
 */
class InMemoryNotificationQueue implements NotificationQueue {
  private items: NotificationQueueItem[] = [];

  async enqueue(item: NotificationQueueItem): Promise<void> {
    this.items.push(item);
  }

  /** Returns and clears every currently-queued item. */
  drain(): NotificationQueueItem[] {
    const drained = this.items;
    this.items = [];
    return drained;
  }

  peek(): NotificationQueueItem[] {
    return [...this.items];
  }
}

export const inMemoryNotificationQueue = new InMemoryNotificationQueue();

let activeQueue: NotificationQueue = inMemoryNotificationQueue;

export function setActiveNotificationQueue(queue: NotificationQueue): void {
  activeQueue = queue;
}

export function getActiveNotificationQueue(): NotificationQueue {
  return activeQueue;
}
