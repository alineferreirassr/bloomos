"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { registerCheckpoint43ProviderFactories } from "@/modules/integrations/registerCheckpoint43ProviderFactories";
import { applyConnectionEvent, attachCredential, getConnection, installProvider, listConnections } from "@/core/integrations/integrationManager";
import { issueProviderSecretCredential, resolveProviderSecret, rotateProviderSecretCredential } from "@/core/integrations/credentialManager";
import { TwilioProvider } from "@/core/integrations/providers/twilio/twilioProvider";
import { getLogger } from "@/core/observability/logger";
import type { IntegrationConnection } from "@/core/integrations/types";

const GENERIC_ACCESS_ERROR = "The Twilio connection isn't available. You may not have access to it.";

registerBuiltinProviders();
registerCheckpoint43ProviderFactories();

export type ManageTwilioConnectionResult<T> = { success: true; data: T } | { success: false; error: string };

function getOrInstallTwilioConnectionSync(workspaceId: string): IntegrationConnection | null {
  return listConnections(workspaceId).find((connection) => connection.provider_id === "twilio") ?? null;
}

/**
 * v2 Checkpoint 43 — mirrors `connectStripeAction`'s own discipline
 * exactly: the pasted Account SID/Auth Token/from-number are tested with
 * a genuine Twilio API call before ever being persisted or the
 * connection transitioning to `connected`.
 */
export async function connectTwilioAction(accountSid: string, authToken: string, fromNumber: string): Promise<ManageTwilioConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const trimmedSid = accountSid.trim();
  const trimmedToken = authToken.trim();
  const trimmedFrom = fromNumber.trim();
  if (!trimmedSid.startsWith("AC")) return { success: false, error: 'A Twilio Account SID starts with "AC".' };
  if (!trimmedFrom.startsWith("+")) return { success: false, error: "The from-number should be in E.164 format, starting with a +." };

  const provider = new TwilioProvider(trimmedSid, trimmedToken, trimmedFrom);
  const testResult = await provider.ping();
  if (!testResult.ok) {
    getLogger().warn("Twilio connection test failed", { workspaceId: session.workspace.id, error: testResult.error });
    return { success: false, error: `Twilio rejected these credentials: ${testResult.error ?? "unknown error"}.` };
  }

  const connection = getOrInstallTwilioConnectionSync(session.workspace.id) ?? (await installProvider({ workspaceId: session.workspace.id, providerId: "twilio", installedBy: session.membership.id }));
  const packedSecret = `${trimmedSid}:${trimmedToken}:${trimmedFrom}`;

  let withCredential = connection;
  if (connection.credential_id) {
    const rotated = await rotateProviderSecretCredential(connection.credential_id, packedSecret);
    if (!rotated) return { success: false, error: "Could not update the existing Twilio credential." };
  } else {
    const credential = await issueProviderSecretCredential({ workspaceId: session.workspace.id, connectionId: connection.id, createdBy: session.membership.id, secret: packedSecret });
    const updated = attachCredential(connection.id, credential.id);
    if (!updated) return { success: false, error: "Could not attach the new Twilio credential to this connection." };
    withCredential = updated;
  }

  try {
    if (withCredential.state === "disabled") await applyConnectionEvent(connection.id, "enable_requested", session.membership.id);
    const afterEnable = getConnection(connection.id) ?? withCredential;
    if (afterEnable.state === "disconnected" || afterEnable.state === "failed") {
      await applyConnectionEvent(connection.id, afterEnable.state === "failed" ? "reconnect_requested" : "connect_requested", session.membership.id);
    }
    const result = await applyConnectionEvent(connection.id, "connect_succeeded", session.membership.id, `Verified with a real Twilio account lookup, ${testResult.latencyMs}ms.`);
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not complete the connection." };
  }
}

export async function testTwilioConnectionAction(connectionId: string): Promise<ManageTwilioConnectionResult<{ ok: boolean; latencyMs: number; error?: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || connection.provider_id !== "twilio") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!connection.credential_id) return { success: false, error: "This connection has no credential yet." };

  const secret = await resolveProviderSecret(connection.credential_id);
  if (!secret) return { success: false, error: "This connection's credential could not be resolved." };
  const [accountSid, authToken, fromNumber] = secret.split(":");
  if (!accountSid || !authToken || !fromNumber) return { success: false, error: "This connection's credential is malformed." };

  const result = await new TwilioProvider(accountSid, authToken, fromNumber).ping();
  try {
    if (result.ok && connection.state !== "connected") await applyConnectionEvent(connectionId, "connect_succeeded", session.membership.id, `Re-tested: ${result.latencyMs}ms.`);
    else if (!result.ok) await applyConnectionEvent(connectionId, "health_check_failed", session.membership.id, result.error ?? "Health check failed.");
  } catch (error) {
    getLogger().warn("Twilio connection test transition failed", { connectionId, error: error instanceof Error ? error.message : "Unknown error" });
  }
  return { success: true, data: result };
}

export async function disconnectTwilioAction(connectionId: string): Promise<ManageTwilioConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.disconnect")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || connection.provider_id !== "twilio") return { success: false, error: GENERIC_ACCESS_ERROR };

  try {
    const result = await applyConnectionEvent(connectionId, "disable_requested", session.membership.id, "Disconnected by a workspace member.");
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not disconnect." };
  }
}
