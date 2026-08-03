"use client";

import { createElement, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConnectorConfigForm } from "@/modules/marketplace/components/ConnectorConfigForm";
import { resolveConnectorIcon } from "@/modules/marketplace/components/connectorIcons";
import { installConnectorAction } from "@/modules/marketplace/manageConnectorInstallationsActions";
import { API_SCOPE_DESCRIPTIONS } from "@/types/apiScope";
import { CONNECTOR_CATEGORY_LABELS, type ConnectorDefinition } from "@/types/connector";
import type { ConnectorConfigValue } from "@/types/connectorInstallation";

interface ConnectorDetailModalProps {
  connector: ConnectorDefinition;
  alreadyInstalled: boolean;
  onClose: () => void;
  onInstalled: () => void;
}

/**
 * Checkpoint 18, Step 2 — the Marketplace's own Details + Configuration
 * surface, combined into a single modal (the same "one modal, not two
 * pages" shape `CreateWebhookEndpointModal.tsx` already established for a
 * comparable form). Shows exactly what the checkpoint's own Security
 * model calls for a member to see before installing: the requested API
 * scopes and the Webhook events this connector would subscribe to,
 * neither of which are ever silently expanded at install time.
 */
export function ConnectorDetailModal({ connector, alreadyInstalled, onClose, onInstalled }: ConnectorDetailModalProps) {
  const [config, setConfig] = useState<Record<string, ConnectorConfigValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rendered via `createElement` rather than a `<Icon />` JSX tag — same reasoning `KpiCard.tsx` already documents.
  const iconElement = createElement(resolveConnectorIcon(connector.icon), { strokeWidth: 2, className: "h-5 w-5", "aria-hidden": true });

  const install = async () => {
    setSubmitting(true);
    setError(null);
    const result = await installConnectorAction(connector.id, config);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onInstalled();
  };

  return (
    <Modal open onClose={onClose} title={connector.name}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-text">{iconElement}</span>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="outline">{CONNECTOR_CATEGORY_LABELS[connector.category]}</Badge>
              {alreadyInstalled ? <Badge tone="success">Installed</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-text-muted">{connector.description}</p>
          </div>
        </div>

        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        <div>
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">API access requested</p>
          <ul className="mt-1.5 space-y-1">
            {connector.requiredApiScopes.map((scope) => (
              <li key={scope} className="text-xs text-text">
                <code className="text-text">{scope}</code> <span className="text-text-muted">— {API_SCOPE_DESCRIPTIONS[scope]}</span>
              </li>
            ))}
          </ul>
        </div>

        {connector.subscribedWebhookEvents.length > 0 ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Subscribes to events</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {connector.subscribedWebhookEvents.map((type) => (
                <code key={type} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-text">
                  {type}
                </code>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-muted">Metadata only — create a matching Webhook Endpoint in the Developer Console for live delivery.</p>
          </div>
        ) : null}

        {!alreadyInstalled ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Configuration</p>
            <div className="mt-2">
              <ConnectorConfigForm idPrefix={`connector-${connector.id}`} configSchema={connector.configSchema} values={config} onChange={(key, value) => setConfig((current) => ({ ...current, [key]: value }))} />
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          {alreadyInstalled ? (
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          ) : (
            <>
              <Button onClick={install} disabled={submitting}>
                {submitting ? "Installing…" : "Install"}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
