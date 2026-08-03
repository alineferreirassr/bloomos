import type { NotificationPreferences, CommunicationCategory, DigestFrequency, QuietHours } from "@/types/communication";
import type { NotificationPriority } from "@/core/notifications/types";

/** v2.0 Checkpoint 24, Step 3 — Notification Preferences. One row per member, upserted, following the same "current state, not history" shape as `presenceStore.ts`. */
let preferencesByMember: Record<string, NotificationPreferences> = {};

/** Test-only: restore the store to empty between test cases. */
export function resetNotificationPreferencesStore(): void {
  preferencesByMember = {};
}

function defaultPreferences(workspaceId: string, memberId: string): NotificationPreferences {
  return {
    workspace_id: workspaceId,
    member_id: memberId,
    desktop_enabled: true,
    in_app_enabled: true,
    email_enabled: false,
    sms_enabled: false,
    push_enabled: false,
    quiet_hours: { enabled: false, startHour: 21, endHour: 8 },
    muted_categories: [],
    minimum_priority: "low",
    digest_frequency: "daily",
  };
}

async function getPreferences(workspaceId: string, memberId: string): Promise<NotificationPreferences> {
  return preferencesByMember[memberId] ?? defaultPreferences(workspaceId, memberId);
}

export interface UpdatePreferencesInput {
  desktopEnabled?: boolean;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  quietHours?: QuietHours;
  mutedCategories?: CommunicationCategory[];
  minimumPriority?: NotificationPriority;
  digestFrequency?: DigestFrequency;
}

async function updatePreferences(workspaceId: string, memberId: string, input: UpdatePreferencesInput): Promise<NotificationPreferences> {
  const existing = preferencesByMember[memberId] ?? defaultPreferences(workspaceId, memberId);
  const updated: NotificationPreferences = {
    ...existing,
    desktop_enabled: input.desktopEnabled ?? existing.desktop_enabled,
    in_app_enabled: input.inAppEnabled ?? existing.in_app_enabled,
    email_enabled: input.emailEnabled ?? existing.email_enabled,
    sms_enabled: input.smsEnabled ?? existing.sms_enabled,
    push_enabled: input.pushEnabled ?? existing.push_enabled,
    quiet_hours: input.quietHours ?? existing.quiet_hours,
    muted_categories: input.mutedCategories ?? existing.muted_categories,
    minimum_priority: input.minimumPriority ?? existing.minimum_priority,
    digest_frequency: input.digestFrequency ?? existing.digest_frequency,
  };
  preferencesByMember = { ...preferencesByMember, [memberId]: updated };
  return updated;
}

/** v2.0 Checkpoint 41 — Notification Health Engine's `preference_health` category: how many members in this workspace have ever called `updatePreferences` (vs. still relying on `defaultPreferences()`). */
export function countConfiguredPreferences(workspaceId: string): number {
  return Object.values(preferencesByMember).filter((p) => p.workspace_id === workspaceId).length;
}

export const mockNotificationPreferencesRepository = {
  getPreferences,
  updatePreferences,
};
