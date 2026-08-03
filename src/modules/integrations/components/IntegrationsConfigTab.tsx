"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BadgeTone } from "@/components/ui/Badge";
import { applyConnectionEventAction, installProviderAction, uninstallConnectionAction } from "@/modules/integrations/manageIntegrationConnectionsActions";
import { StripeConnectPanel } from "@/modules/integrations/stripe/components/StripeConnectPanel";
import { CONNECTION_STATE_LABELS } from "@/core/integrations/types";
import type { ConnectionEvent, ConnectionState, ProviderDefinition } from "@/core/integrations/types";
import type { ConnectionWithHealth } from "@/modules/integrations/getIntegrationsConsoleData";

/** v2 Checkpoint 23 — providers with a real SDK implementation get their own dedicated connection flow (real API verification before any state transition), not the generic "just flip the state" table below. Stripe is the first. */
const REAL_PROVIDER_IDS = new Set(["stripe"]);

const STATE_TONE: Record<ConnectionState, BadgeTone> = {
  disconnected: "neutral",
  connecting: "warning",
  connected: "success",
  expired: "warning",
  refreshing: "warning",
  failed: "danger",
  disabled: "neutral",
  reconnecting: "warning",
  unknown: "neutral",
};

const ACTION_LABELS: Record<ConnectionEvent, string> = {
  connect_requested: "Connect",
  connect_succeeded: "Mark connected",
  connect_failed: "Mark failed",
  token_expired: "Mark token expired",
  refresh_requested: "Refresh token",
  refresh_succeeded: "Mark refreshed",
  refresh_failed: "Mark refresh failed",
  disable_requested: "Disable",
  enable_requested: "Enable",
  reconnect_requested: "Reconnect",
  health_check_failed: "Mark health check failed",
  health_check_unknown: "Mark health unknown",
};

/** Only the events a member would actually click — the rest (`connect_succeeded`, `connect_failed`, `refresh_succeeded`, `refresh_failed`, `health_check_*`) are outcomes a real provider callback would report, not something a human requests by hand. */
const USER_FACING_EVENTS = new Set<ConnectionEvent>(["connect_requested", "refresh_requested", "disable_requested", "enable_requested", "reconnect_requested"]);

interface IntegrationsConfigTabProps {
  providers: ProviderDefinition[];
  connections: ConnectionWithHealth[];
  onChanged: () => void;
}

/**
 * The Configuration Center (v2 Checkpoint 22, Step 14) — install a
 * provider from the registry (creates a `disconnected` connection, no
 * real handshake), then walk it through the Connection State Machine by
 * hand via the buttons `listAvailableActions` says are legal right now.
 * Never calls a real provider — every "Connect"/"Refresh" here is local
 * bookkeeping, exactly like Marketplace's own "Reconnect" (Checkpoint 18).
 */
export function IntegrationsConfigTab({ providers, connections, onChanged }: IntegrationsConfigTabProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const genericConnections = connections.filter((entry) => !REAL_PROVIDER_IDS.has(entry.connection.provider_id));
  const installedProviderIds = new Set(connections.map((entry) => entry.connection.provider_id));
  const availableProviders = providers.filter((provider) => !installedProviderIds.has(provider.id) && !REAL_PROVIDER_IDS.has(provider.id));

  const runAction = async (id: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(id);
    setActionError(null);
    const result = await action();
    setBusyId(null);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    onChanged();
  };

  return (
    <div className="space-y-4">
      {actionError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {actionError}
        </div>
      ) : null}

      <StripeConnectPanel />

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Installed connections</h3>
        {genericConnections.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No connections yet" description="Install a provider below to create your first connection." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Provider</th>
                  <th className="pb-2 pr-3 font-normal">State</th>
                  <th className="pb-2 pr-3 font-normal">Failures</th>
                  <th className="pb-2 pr-3 font-normal">Installed</th>
                  <th className="pb-2 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {genericConnections.map(({ connection, provider, availableActions }) => (
                  <tr key={connection.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{provider?.name ?? connection.provider_id}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={STATE_TONE[connection.state]}>{CONNECTION_STATE_LABELS[connection.state]}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{connection.failure_count}</td>
                    <td className="py-2 pr-3 text-text-muted">{new Date(connection.created_at).toLocaleDateString()}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {availableActions
                          .filter((event) => USER_FACING_EVENTS.has(event))
                          .map((event) => (
                            <Button
                              key={event}
                              variant="secondary"
                              disabled={busyId === connection.id}
                              onClick={() => runAction(connection.id, () => applyConnectionEventAction(connection.id, event))}
                            >
                              {ACTION_LABELS[event]}
                            </Button>
                          ))}
                        <Button variant="secondary" disabled={busyId === connection.id} onClick={() => runAction(connection.id, () => uninstallConnectionAction(connection.id))}>
                          Uninstall
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Provider catalog</h3>
        {availableProviders.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Every registered provider is already installed" description="Uninstall a connection to reinstall it, or add a new provider to the registry." />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableProviders.map((provider) => (
              <div key={provider.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-text">{provider.name}</p>
                  <Badge tone="outline">{provider.category}</Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">{provider.description}</p>
                <Button className="mt-3" variant="secondary" disabled={busyId === provider.id} onClick={() => runAction(provider.id, () => installProviderAction(provider.id))}>
                  Install
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
