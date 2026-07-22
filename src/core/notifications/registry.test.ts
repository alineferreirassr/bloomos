import { describe, expect, it } from "vitest";
import { registerNotificationProvider, getNotificationProvider, isChannelConfigured } from "@/core/notifications/registry";
import type { NotificationProvider } from "@/core/notifications/types";

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
