import { registerNotificationProvider } from "@/core/notifications/registry";
import { getWorkspaceMemberById, getClientAccountById } from "@/lib/data";
import { listConnections } from "@/core/integrations/integrationManager";
import { resolveAccessToken } from "@/core/integrations/credentialManager";
import { GmailProvider } from "@/core/integrations/providers/gmail/gmailProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { insertErrorRecord } from "@/lib/data/core/integrations/errorRecordStore";
import type { NotificationDeliveryRequest, NotificationProvider } from "@/core/notifications/types";

let registered = false;

/**
 * v2 Checkpoint 43 — Notification Integration. The Notification Platform
 * (Checkpoint 24) keeps every responsibility named in the checkpoint spec
 * — intent, routing, category, priority, preferences, quiet hours, audit,
 * analytics; this file is delivery-only, the one thing `NotificationProvider`
 * (`core/notifications/types.ts`) actually asks an adapter to do.
 *
 * `NotificationDeliveryRequest` carries no workspace id, and
 * `registerNotificationProvider()` registers exactly one provider per
 * channel globally. So the workspace's own connected Gmail account is
 * resolved *inside* this adapter, from the recipient's own `workspace_id`
 * — never a second, parallel per-workspace registry.
 *
 * v2 Checkpoint 44, Step 6 — `request.recipientClientAccountId` resolves
 * against `ClientAccount` (`email`/`workspace_id` live directly on that
 * record) instead of `TeamMember`, the same "member XOR client" branch
 * `Notification`'s own two recipient fields already established. Every
 * other step of delivery (Gmail connection lookup, error sanitization) is
 * identical for both recipient kinds — this file still never distinguishes
 * "who" beyond that one resolution step.
 *
 * SMS delivery (Twilio) is honestly NOT wired here — `TeamMember` has no
 * `phone` field today (confirmed: `types/teamMember.ts` carries only
 * `email`), a pre-existing gap this checkpoint didn't introduce and isn't
 * in scope to fix by adding a schema field. `isChannelConfigured("sms")`
 * correctly continues to report `false` until that field exists.
 */
export function registerIntegrationNotificationProviders(): void {
  if (registered) return;

  const emailProvider: NotificationProvider = {
    channel: "email",
    async send(request: NotificationDeliveryRequest): Promise<{ success: true } | { success: false; error: string }> {
      const recipient = request.recipientClientAccountId
        ? await getClientAccountById(request.recipientClientAccountId)
            .then((account) => ({ email: account.email, workspaceId: account.workspace_id }))
            .catch(() => null)
        : request.recipientMemberId
          ? await getWorkspaceMemberById(request.recipientMemberId)
              .then((member) => ({ email: member.email, workspaceId: member.workspace_id }))
              .catch(() => null)
          : null;
      if (!recipient) return { success: false, error: "Recipient could not be resolved." };

      const connection = listConnections(recipient.workspaceId).find((c) => c.provider_id === "gmail" && c.state === "connected");
      if (!connection?.credential_id) return { success: false, error: "No connected Gmail account for this workspace." };

      const accessToken = await resolveAccessToken(connection.credential_id);
      if (!accessToken) return { success: false, error: "Gmail credential could not be resolved." };

      try {
        const provider = new GmailProvider(accessToken, recipient.email);
        await provider.sendEmail({ to: recipient.email, subject: request.title, body: request.body });
        return { success: true };
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : "Unknown Gmail delivery error";
        const record = sanitizeIntegrationError({ connectionId: connection.id, providerId: "gmail", rawMessage });
        insertErrorRecord(record);
        return { success: false, error: record.message };
      }
    },
  };

  registerNotificationProvider(emailProvider);
  registered = true;
}

/** Test-only: undo the module-level idempotency guard so a fresh test can re-register against a reset registry. */
export function resetIntegrationNotificationProvidersRegistration(): void {
  registered = false;
}
