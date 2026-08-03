"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BadgeTone } from "@/components/ui/Badge";
import { replayAllDeadLetterDeliveriesAction, replayWebhookDeliveryAction } from "@/modules/webhooks/manageWebhookDeliveriesActions";
import type { WebhookDelivery, WebhookDeliverySummary } from "@/types/webhookDelivery";
import type { PublicWebhookEndpoint } from "@/types/webhookEndpoint";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

const STATUS_TONE: Record<WebhookDelivery["status"], BadgeTone> = {
  pending: "neutral",
  retrying: "warning",
  success: "success",
  failed: "danger",
  dead_letter: "danger",
};

const STATUS_LABEL: Record<WebhookDelivery["status"], string> = {
  pending: "Pending",
  retrying: "Retrying",
  success: "Success",
  failed: "Failed",
  dead_letter: "Dead letter",
};

interface DeliveriesTabProps {
  deliveries: WebhookDelivery[];
  summary: WebhookDeliverySummary;
  endpoints: PublicWebhookEndpoint[];
  onChanged: () => void;
}

/** Checkpoint 17, Step 8/9/10 — Delivery History + Replay + Observability, all in one tab: a summary strip (Step 10's own "Deliveries, Failures, Retry count, Latency, Replay") above a full history table. v2 Checkpoint 22, Step 7 extends this with a Dead Letter Queue filter and a bulk "Replay all" action. */
export function DeliveriesTab({ deliveries, summary, endpoints, onChanged }: DeliveriesTabProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkReplaying, setBulkReplaying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dlqOnly, setDlqOnly] = useState(false);

  const endpointUrl = (endpointId: string): string => endpoints.find((endpoint) => endpoint.id === endpointId)?.url ?? endpointId;

  const replay = async (deliveryId: string) => {
    setBusyId(deliveryId);
    setActionError(null);
    const result = await replayWebhookDeliveryAction(deliveryId);
    setBusyId(null);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    onChanged();
  };

  const replayAllDeadLetter = async () => {
    setBulkReplaying(true);
    setActionError(null);
    const result = await replayAllDeadLetterDeliveriesAction();
    setBulkReplaying(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    onChanged();
  };

  const visibleDeliveries = dlqOnly ? deliveries.filter((delivery) => delivery.status === "dead_letter") : deliveries;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <p className="text-xs text-text-muted">Deliveries</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.totalDeliveries.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Success</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.successCount.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Failures</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.failureCount.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Dead letter</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.deadLetterCount.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Retries</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.totalRetries.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Avg. latency</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.averageDurationMs} ms</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-[17px] font-semibold text-text">Deliveries</h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input type="checkbox" checked={dlqOnly} onChange={(event) => setDlqOnly(event.target.checked)} aria-label="Show Dead Letter Queue only" />
              Dead Letter Queue only
            </label>
            {summary.deadLetterCount > 0 ? (
              <Button variant="secondary" disabled={bulkReplaying} onClick={replayAllDeadLetter}>
                {bulkReplaying ? "Replaying…" : `Replay all (${summary.deadLetterCount})`}
              </Button>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {actionError}
          </div>
        ) : null}

        {visibleDeliveries.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title={dlqOnly ? "The Dead Letter Queue is empty" : "No deliveries yet"}
              description={dlqOnly ? "Nothing has exhausted every retry attempt." : "Deliveries appear here once a subscribed event fires or you send a test delivery."}
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Event</th>
                  <th className="pb-2 pr-3 font-normal">Endpoint</th>
                  <th className="pb-2 pr-3 font-normal">Status</th>
                  <th className="pb-2 pr-3 font-normal">Attempts</th>
                  <th className="pb-2 pr-3 font-normal">Status code</th>
                  <th className="pb-2 pr-3 font-normal">Duration</th>
                  <th className="pb-2 pr-3 font-normal">Created</th>
                  <th className="pb-2 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">
                      <code className="text-xs">{delivery.event_type}</code>
                      {delivery.is_test ? (
                        <Badge tone="outline" className="ml-2">
                          test
                        </Badge>
                      ) : null}
                      {delivery.replayed_from_delivery_id ? (
                        <Badge tone="outline" className="ml-2">
                          replay
                        </Badge>
                      ) : null}
                    </td>
                    <td className="max-w-[16rem] truncate py-2 pr-3 text-text-muted" title={endpointUrl(delivery.endpoint_id)}>
                      {endpointUrl(delivery.endpoint_id)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={STATUS_TONE[delivery.status]}>{STATUS_LABEL[delivery.status]}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {delivery.attempts} / {delivery.max_attempts}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{delivery.last_status_code ?? "—"}</td>
                    <td className="py-2 pr-3 text-text-muted">{delivery.last_duration_ms !== null ? `${delivery.last_duration_ms} ms` : "—"}</td>
                    <td className="py-2 pr-3 text-text-muted">{formatDateTime(delivery.created_at)}</td>
                    <td className="py-2">
                      <Button variant="secondary" disabled={busyId === delivery.id} onClick={() => replay(delivery.id)}>
                        Replay
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
