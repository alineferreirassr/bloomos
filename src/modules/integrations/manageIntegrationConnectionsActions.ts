"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { applyConnectionEvent, getConnection, installProvider, uninstallConnection } from "@/core/integrations/integrationManager";
import { getLogger } from "@/core/observability/logger";
import type { ConnectionEvent, IntegrationConnection } from "@/core/integrations/types";

const GENERIC_ACCESS_ERROR = "The Integrations Console isn't available. You may not have access to it.";

export type ManageIntegrationConnectionsResult<T> = { success: true; data: T } | { success: false; error: string };

/** v2 Checkpoint 22, Step 14 — the Configuration Center's own "Install" action. Never connects to a real provider; creates a `disconnected` `IntegrationConnection` a member can then walk through the Connection State Machine by hand. */
export async function installProviderAction(providerId: string): Promise<ManageIntegrationConnectionsResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  try {
    const connection = await installProvider({ workspaceId: session.workspace.id, providerId, installedBy: session.membership.id });
    return { success: true, data: connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not install this provider." };
  }
}

function assertOwnedByWorkspace(connectionId: string, workspaceId: string): { ok: true } | { ok: false; error: string } {
  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== workspaceId) return { ok: false, error: GENERIC_ACCESS_ERROR };
  return { ok: true };
}

/** The one door every Configuration Center connection action goes through — `event` is validated against the Connection State Machine inside `applyConnectionEvent` itself, so an illegal transition surfaces as a normal error, never a crash. */
export async function applyConnectionEventAction(connectionId: string, event: ConnectionEvent): Promise<ManageIntegrationConnectionsResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const ownership = assertOwnedByWorkspace(connectionId, session.workspace.id);
  if (!ownership.ok) return { success: false, error: ownership.error };

  try {
    const result = await applyConnectionEvent(connectionId, event, session.membership.id);
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not apply this action." };
  }
}

export async function uninstallConnectionAction(connectionId: string): Promise<ManageIntegrationConnectionsResult<{ removed: boolean }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const ownership = assertOwnedByWorkspace(connectionId, session.workspace.id);
  if (!ownership.ok) return { success: false, error: ownership.error };

  const removed = await uninstallConnection(connectionId, session.membership.id);
  getLogger().info("Integration connection uninstalled", { workspaceId: session.workspace.id, connectionId });
  return { success: true, data: { removed } };
}
