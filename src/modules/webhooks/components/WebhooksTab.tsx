"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SecretRevealModal } from "@/components/ui/SecretRevealModal";
import { CreateWebhookEndpointModal } from "@/modules/webhooks/components/CreateWebhookEndpointModal";
import { createWebhookEndpointAction, rotateWebhookEndpointSecretAction, setWebhookEndpointStatusAction, testWebhookEndpointDeliveryAction } from "@/modules/webhooks/manageWebhookEndpointsActions";
import type { PublicWebhookEndpoint } from "@/types/webhookEndpoint";
import type { WebhookEventDefinition } from "@/types/webhookEvent";

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "Never";
}

interface WebhooksTabProps {
  endpoints: PublicWebhookEndpoint[];
  catalog: WebhookEventDefinition[];
  onChanged: () => void;
}

/** Checkpoint 17, Step 9 — the Developer Console's Webhooks tab: list, create, rotate, enable/disable, and test-deliver, mirroring the API Keys tab's exact table/modal shape. */
export function WebhooksTab({ endpoints, catalog, onChanged }: WebhooksTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [secretModal, setSecretModal] = useState<{ name: string; secret: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Webhooks</h3>
        <Button onClick={() => setCreateOpen(true)}>New Webhook</Button>
      </div>

      {actionError ? (
        <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {actionError}
        </div>
      ) : null}
      <div role="status" className="sr-only">
        {statusMessage ?? ""}
      </div>

      {endpoints.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No Webhooks yet" description="Create one to notify an external system whenever a business event occurs." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="pb-2 pr-3 font-normal">URL</th>
                <th className="pb-2 pr-3 font-normal">Events</th>
                <th className="pb-2 pr-3 font-normal">Status</th>
                <th className="pb-2 pr-3 font-normal">Last delivery</th>
                <th className="pb-2 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={endpoint.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-text">
                    <div className="max-w-xs truncate" title={endpoint.url}>
                      {endpoint.url}
                    </div>
                    {endpoint.description ? <div className="text-xs text-text-muted">{endpoint.description}</div> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {endpoint.subscribed_events.map((type) => (
                        <Badge key={type} tone="outline">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={endpoint.status === "enabled" ? "accent" : "neutral"}>{endpoint.status === "enabled" ? "Enabled" : "Disabled"}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-text-muted">
                    {formatDateTime(endpoint.last_delivery_at)}
                    {endpoint.last_delivery_status ? (
                      <Badge tone={endpoint.last_delivery_status === "success" ? "success" : "danger"} className="ml-2">
                        {endpoint.last_delivery_status}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={busyId === endpoint.id}
                        onClick={() =>
                          runAction(endpoint.id, async () => {
                            const result = await rotateWebhookEndpointSecretAction(endpoint.id);
                            if (!result.success) return { success: false, error: result.error };
                            setSecretModal({ name: endpoint.description ?? endpoint.url, secret: result.data.secret });
                            return { success: true };
                          })
                        }
                      >
                        Rotate
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busyId === endpoint.id}
                        onClick={() => runAction(endpoint.id, () => setWebhookEndpointStatusAction(endpoint.id, endpoint.status === "enabled" ? "disabled" : "enabled"))}
                      >
                        {endpoint.status === "enabled" ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busyId === endpoint.id}
                        onClick={() =>
                          runAction(endpoint.id, async () => {
                            const result = await testWebhookEndpointDeliveryAction(endpoint.id);
                            if (!result.success) return { success: false, error: result.error };
                            setStatusMessage("Test delivery sent — see the Deliveries tab for the result.");
                            return { success: true };
                          })
                        }
                      >
                        Test delivery
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateWebhookEndpointModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        catalog={catalog}
        onCreate={createWebhookEndpointAction}
        onCreated={(result) => {
          setSecretModal({ name: result.endpoint.description ?? result.endpoint.url, secret: result.secret });
          onChanged();
        }}
      />

      <SecretRevealModal open={secretModal !== null} onClose={() => setSecretModal(null)} name={secretModal?.name ?? ""} secret={secretModal?.secret ?? ""} kind="Webhook Secret" />
    </Card>
  );
}
