import type { NotificationChannel, NotificationProvider } from "@/core/notifications/types";

/**
 * Dependency inversion for delivery: BloomOS code calls
 * `getNotificationProvider(channel)` and never a vendor SDK directly. Empty
 * by default — `email`/`sms`/`push` have no provider registered until a
 * real adapter (e.g. a future SendGrid/Twilio/FCM package) calls
 * `registerNotificationProvider` at its own module-init time. `in_app`
 * never needs a provider here since it's a stored row, not a delivery
 * (see `lib/data/core/notifications/mockRepository.ts`).
 */
const providers = new Map<NotificationChannel, NotificationProvider>();

export function registerNotificationProvider(provider: NotificationProvider): void {
  providers.set(provider.channel, provider);
}

export function getNotificationProvider(channel: NotificationChannel): NotificationProvider | undefined {
  return providers.get(channel);
}

export function isChannelConfigured(channel: NotificationChannel): boolean {
  return channel === "in_app" || providers.has(channel);
}
