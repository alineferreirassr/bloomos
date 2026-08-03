"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getConnection, setConnectionConfig } from "@/core/integrations/integrationManager";
import { issueProviderSecretCredential, rotateProviderSecretCredential } from "@/core/integrations/credentialManager";

const GENERIC_ACCESS_ERROR = "That DocuSign connection isn't available. You may not have access to it.";

export type ManageDocuSignWebhookResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * v2 Checkpoint 43 — mirrors `setStripeWebhookSecretAction` exactly: a
 * DocuSign Connect HMAC secret is real secret material (a leaked one lets
 * an attacker forge inbound envelope-status webhooks), so it's stored the
 * same way — encrypted via `issueProviderSecretCredential`, never in
 * `IntegrationConnection.config` directly. Only the resulting credential
 * id lives in `config.webhook_secret_credential_id`. A workspace pastes
 * this in after creating the real Connect configuration in their own
 * DocuSign account, pointed at `/api/webhooks/docusign/{connectionId}`.
 */
export async function setDocuSignWebhookSecretAction(connectionId: string, webhookSecret: string): Promise<ManageDocuSignWebhookResult<{ connectionId: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.signatures")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || connection.provider_id !== "docusign") return { success: false, error: GENERIC_ACCESS_ERROR };

  const trimmed = webhookSecret.trim();
  if (trimmed.length < 8) return { success: false, error: "That doesn't look like a real DocuSign Connect HMAC secret." };

  const existingCredentialId = connection.config.webhook_secret_credential_id;
  if (typeof existingCredentialId === "string" && existingCredentialId) {
    const rotated = await rotateProviderSecretCredential(existingCredentialId, trimmed);
    if (!rotated) return { success: false, error: "Could not update the existing webhook secret." };
  } else {
    const credential = await issueProviderSecretCredential({ workspaceId: session.workspace.id, connectionId, createdBy: session.membership.id, secret: trimmed });
    setConnectionConfig(connectionId, { webhook_secret_credential_id: credential.id });
  }

  return { success: true, data: { connectionId } };
}
