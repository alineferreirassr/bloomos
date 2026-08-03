import type { ContactMethod } from "@/core/enums/contactMethod";

/**
 * Checkpoint 36, Step 11/12 — one preferences row per Client Account,
 * mirroring `notificationPreferencesStore.ts`'s own "current state, not
 * history" shape (Checkpoint 24) exactly, but keyed by `client_account_id`
 * rather than a team member id — the two are different id spaces and are
 * deliberately never mixed into the same store.
 */
export interface ClientPortalPreferences {
  workspace_id: string;
  client_account_id: string;
  communication_preference: ContactMethod | null;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  theme: "light" | "dark" | "system";
  timezone: string | null;
}

let preferencesByAccount: Record<string, ClientPortalPreferences> = {};

/** Test-only: restore the store to empty between test cases. */
export function resetClientPortalPreferencesStore(): void {
  preferencesByAccount = {};
}

function defaultPreferences(workspaceId: string, clientAccountId: string): ClientPortalPreferences {
  return {
    workspace_id: workspaceId,
    client_account_id: clientAccountId,
    communication_preference: null,
    email_notifications_enabled: true,
    sms_notifications_enabled: false,
    theme: "system",
    timezone: null,
  };
}

export async function getClientPortalPreferences(workspaceId: string, clientAccountId: string): Promise<ClientPortalPreferences> {
  return preferencesByAccount[clientAccountId] ?? defaultPreferences(workspaceId, clientAccountId);
}

export interface UpdateClientPortalPreferencesInput {
  communicationPreference?: ContactMethod | null;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  theme?: "light" | "dark" | "system";
  timezone?: string | null;
}

export async function updateClientPortalPreferences(workspaceId: string, clientAccountId: string, input: UpdateClientPortalPreferencesInput): Promise<ClientPortalPreferences> {
  const existing = preferencesByAccount[clientAccountId] ?? defaultPreferences(workspaceId, clientAccountId);
  const updated: ClientPortalPreferences = {
    ...existing,
    communication_preference: input.communicationPreference !== undefined ? input.communicationPreference : existing.communication_preference,
    email_notifications_enabled: input.emailNotificationsEnabled ?? existing.email_notifications_enabled,
    sms_notifications_enabled: input.smsNotificationsEnabled ?? existing.sms_notifications_enabled,
    theme: input.theme ?? existing.theme,
    timezone: input.timezone !== undefined ? input.timezone : existing.timezone,
  };
  preferencesByAccount = { ...preferencesByAccount, [clientAccountId]: updated };
  return updated;
}
