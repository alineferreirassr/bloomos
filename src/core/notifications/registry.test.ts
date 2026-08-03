import { describe, expect, it, beforeEach } from "vitest";
import { registerNotificationProvider, getNotificationProvider, isChannelConfigured } from "@/core/notifications/registry";
import { inMemoryNotificationQueue, setActiveNotificationQueue, getActiveNotificationQueue } from "@/core/notifications/queue";
import type { NotificationProvider } from "@/core/notifications/types";
import type { NotificationQueue } from "@/core/notifications/queue";

describe("notification provider registry", () => {
  it("treats in_app as always configured, with no provider registered", () => {
    expect(isChannelConfigured("in_app")).toBe(true);
    expect(getNotificationProvider("in_app")).toBeUndefined();
  });

  it("treats email/sms/push as unconfigured until a provider registers", () => {
    expect(isChannelConfigured("email")).toBe(false);
    expect(isChannelConfigured("sms")).toBe(false);
    expect(isChannelConfigured("push")).toBe(false);
  });

  it("registers a provider and makes it retrievable by channel", () => {
    const provider: NotificationProvider = {
      channel: "email",
      send: async () => ({ success: true }),
    };
    registerNotificationProvider(provider);

    expect(getNotificationProvider("email")).toBe(provider);
    expect(isChannelConfigured("email")).toBe(true);
  });
});

describe("notification queue", () => {
  beforeEach(() => {
    inMemoryNotificationQueue.drain();
    setActiveNotificationQueue(inMemoryNotificationQueue);
  });

  it("defaults to the in-memory queue", () => {
    expect(getActiveNotificationQueue()).toBe(inMemoryNotificationQueue);
  });

  it("holds enqueued items until drained", async () => {
    await inMemoryNotificationQueue.enqueue({ channel: "in_app", recipientMemberId: "member_1", title: "Hi", body: "Body" });
    expect(inMemoryNotificationQueue.peek()).toHaveLength(1);

    const drained = inMemoryNotificationQueue.drain();
    expect(drained).toHaveLength(1);
    expect(inMemoryNotificationQueue.peek()).toEqual([]);
  });

  it("allows swapping in a real queue implementation without any caller changing", async () => {
    const enqueue = async () => {};
    const stubQueue: NotificationQueue = { enqueue };
    setActiveNotificationQueue(stubQueue);
    expect(getActiveNotificationQueue()).toBe(stubQueue);
  });
});
