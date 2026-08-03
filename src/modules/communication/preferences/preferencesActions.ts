"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockNotificationPreferencesRepository, type UpdatePreferencesInput } from "@/lib/data/core/communication/notificationPreferencesStore";
import type { NotificationPreferences } from "@/types/communication";
import type { DataResult } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "Notification preferences aren't available. You may not have access to them.";

export async function getNotificationPreferencesAction(): Promise<DataResult<NotificationPreferences>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const preferences = await mockNotificationPreferencesRepository.getPreferences(session.workspace.id, session.membership.id);
  return { success: true, data: preferences };
}

/**
 * v2.0 Checkpoint 24, Step 3 — Notification Preferences. `desktopEnabled`/
 * `inAppEnabled` are the only channels this checkpoint can actually honor
 * (no email/SMS/push provider is registered — see `core/notifications/registry.ts`);
 * `emailEnabled`/`smsEnabled`/`pushEnabled` are still stored so a future
 * provider's own onboarding doesn't have to ask the member to set them up a
 * second time, but they have no effect on delivery today.
 */
export async function updateNotificationPreferencesAction(input: UpdatePreferencesInput): Promise<DataResult<NotificationPreferences>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const updated = await mockNotificationPreferencesRepository.updatePreferences(session.workspace.id, session.membership.id, input);
  return { success: true, data: updated };
}
