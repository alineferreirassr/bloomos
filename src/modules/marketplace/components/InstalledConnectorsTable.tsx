"use client";

import { createElement, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BadgeTone } from "@/components/ui/Badge";
import { resolveConnectorIcon } from "@/modules/marketplace/components/connectorIcons";
import { disableConnectorAction, enableConnectorAction, reconnectConnectorAction, uninstallConnectorAction } from "@/modules/marketplace/manageConnectorInstallationsActions";
import type { ConnectorDefinition } from "@/types/connector";
import type { ConnectorHealthStatus, ConnectorInstallation } from "@/types/connectorInstallation";

const HEALTH_TONE: Record<ConnectorHealthStatus, BadgeTone> = {
  connected: "success",
  disconnected: "neutral",
  pending: "outline",
  error: "danger",
  rate_limited: "warning",
};

const HEALTH_LABEL: Record<ConnectorHealthStatus, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  pending: "Pending",
  error: "Error",
  rate_limited: "Rate limited",
};

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "Never";
}

interface InstalledConnectorsTableProps {
  installations: ConnectorInstallation[];
  catalog: ConnectorDefinition[];
  onChanged: () => void;
}

/** Checkpoint 18, Step 3/6 — the Installed tab: every lifecycle action (Enable/Disable/Reconnect/Uninstall) a member can take on a connector they've already installed, plus its real, derived Connection Health. */
export function InstalledConnectorsTable({ installations, catalog, onChanged }: InstalledConnectorsTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const connectorFor = (connectorId: string): ConnectorDefinition | undefined => catalog.find((definition) => definition.id === connectorId);

  const run = async (installationId: string, action: (id: string) => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(installationId);
    setActionError(null);
    const result = await action(installationId);
    setBusyId(null);
    if (!result.success) {
      setActionError(result.error ?? "That action failed.");
      return;
    }
    onChanged();
  };

  if (installations.length === 0) {
    return <EmptyState title="No connectors installed yet" description="Browse the Marketplace and install a connector to see it here." />;
  }

  return (
    <Card>
      {actionError ? (
        <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {actionError}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="pb-2 pr-3 font-normal">Connector</th>
              <th className="pb-2 pr-3 font-normal">Health</th>
              <th className="pb-2 pr-3 font-normal">Reconnects</th>
              <th className="pb-2 pr-3 font-normal">Last sync</th>
              <th className="pb-2 pr-3 font-normal">Installed</th>
              <th className="pb-2 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {installations.map((installation) => {
              const connector = connectorFor(installation.connector_id);
              // Rendered via `createElement` rather than a `<Icon />` JSX tag — same reasoning `KpiCard.tsx` already documents.
              const iconElement = createElement(resolveConnectorIcon(connector?.icon ?? ""), { strokeWidth: 2, className: "h-4 w-4 text-text-muted", "aria-hidden": true });
              const busy = busyId === installation.id;
              return (
                <tr key={installation.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-text">
                    <span className="inline-flex items-center gap-2">
                      {iconElement}
                      {connector?.name ?? installation.connector_id}
                      {!installation.enabled ? (
                        <Badge tone="neutral" className="ml-1">
                          Disabled
                        </Badge>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={HEALTH_TONE[installation.health_status]}>{HEALTH_LABEL[installation.health_status]}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{installation.reconnect_count}</td>
                  <td className="py-2 pr-3 text-text-muted">{formatDateTime(installation.last_sync_at)}</td>
                  <td className="py-2 pr-3 text-text-muted">{formatDateTime(installation.installed_at)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {installation.enabled ? (
                        <Button variant="secondary" disabled={busy} onClick={() => run(installation.id, disableConnectorAction)}>
                          Disable
                        </Button>
                      ) : (
                        <Button variant="secondary" disabled={busy} onClick={() => run(installation.id, enableConnectorAction)}>
                          Enable
                        </Button>
                      )}
                      <Button variant="secondary" disabled={busy} onClick={() => run(installation.id, reconnectConnectorAction)}>
                        Reconnect
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Uninstall ${connector?.name ?? installation.connector_id}? This revokes its API access.`)) run(installation.id, uninstallConnectorAction);
                        }}
                      >
                        Uninstall
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
