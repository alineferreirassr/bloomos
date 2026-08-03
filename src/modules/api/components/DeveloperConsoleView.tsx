"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeveloperConsoleData, type DeveloperConsoleData } from "@/modules/api/getDeveloperConsoleData";
import { createApiKeyAction, rotateApiKeyAction, revokeApiKeyAction } from "@/modules/api/manageApiKeysActions";
import { getWebhooksConsoleData, type WebhooksConsoleData } from "@/modules/webhooks/getWebhooksConsoleData";
import { getIntegrationsConsoleData, type IntegrationsConsoleData } from "@/modules/integrations/getIntegrationsConsoleData";
import { IntegrationsConfigTab } from "@/modules/integrations/components/IntegrationsConfigTab";
import { IntegrationsDiagnosticsTab } from "@/modules/integrations/components/IntegrationsDiagnosticsTab";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { CreateApiKeyModal } from "@/modules/api/components/CreateApiKeyModal";
import { SecretRevealModal } from "@/components/ui/SecretRevealModal";
import { WebhooksTab } from "@/modules/webhooks/components/WebhooksTab";
import { DeliveriesTab } from "@/modules/webhooks/components/DeliveriesTab";
import type { ApiKey, ApiKeyWithSecret } from "@/types/apiKey";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DeveloperConsoleData; webhooks: WebhooksConsoleData; integrations: IntegrationsConsoleData };

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "Never";
}

function keyStatus(key: ApiKey): { label: string; tone: "accent" | "neutral" } {
  return key.revoked_at ? { label: "Revoked", tone: "neutral" } : { label: "Active", tone: "accent" };
}

/**
 * Checkpoint 16, Step 11 — the Developer Console: manage API Keys
 * (create/rotate/revoke, backed by `manageApiKeysActions.ts`), see Usage
 * (backed by `apiUsageStore.ts`'s `summarizeApiUsage()`), and find the
 * Documentation. Every mutation re-fetches `getDeveloperConsoleData()`
 * rather than patching local state — the same "one aggregate, always
 * refetched" discipline `TeamView`'s own `load()` already follows, so the
 * Usage tab never drifts from the Keys tab after a Create/Rotate/Revoke.
 */
export function DeveloperConsoleView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [secretModal, setSecretModal] = useState<{ name: string; secret: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    Promise.all([getDeveloperConsoleData(), getWebhooksConsoleData(), getIntegrationsConsoleData()]).then(([apiResult, webhooksResult, integrationsResult]) => {
      if (!apiResult.success) {
        setState({ status: "error", message: apiResult.error });
        return;
      }
      if (!webhooksResult.success) {
        setState({ status: "error", message: webhooksResult.error });
        return;
      }
      if (!integrationsResult.success) {
        setState({ status: "error", message: integrationsResult.error });
        return;
      }
      setState({ status: "ready", data: apiResult.data, webhooks: webhooksResult.data, integrations: integrationsResult.data });
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    registerCommand({ id: "open-developer-console", label: "Open Developer Console", group: "Developer", keywords: ["developer", "api", "keys", "public api"], run: () => router.push("/developer") });
    return () => unregisterCommand("open-developer-console");
  }, [router]);

  if (state.status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={load} />;
  }

  const { apiKeys, usage } = state.data;
  const { endpoints, deliveries, summary, catalog } = state.webhooks;
  const integrations = state.integrations;

  const runKeyAction = async (id: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(id);
    setActionError(null);
    const result = await action();
    setBusyId(null);
    if (!result.success) {
      setActionError(result.error ?? "Something went wrong.");
      return;
    }
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer"
        subtitle={`Manage Public API Keys, scopes, and usage for trusted third-party applications. ${getDataPersistenceMessage()}`}
      />

      {actionError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {actionError}
        </div>
      ) : null}

      <Tabs defaultValue="keys">
        <TabList aria-label="Developer Console sections">
          <Tab value="keys">API Keys</Tab>
          <Tab value="webhooks">Webhooks</Tab>
          <Tab value="deliveries">Deliveries</Tab>
          <Tab value="integrations">Integrations</Tab>
          <Tab value="diagnostics">Diagnostics</Tab>
          <Tab value="usage">Usage</Tab>
          <Tab value="docs">Documentation</Tab>
        </TabList>

        <TabPanel value="keys" className="mt-4">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-semibold text-text">API Keys</h3>
              <Button onClick={() => setCreateOpen(true)}>New API Key</Button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No API Keys yet" description="Create one to let a trusted application read data through the Public API." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-text-muted">
                      <th className="pb-2 pr-3 font-normal">Name</th>
                      <th className="pb-2 pr-3 font-normal">Prefix</th>
                      <th className="pb-2 pr-3 font-normal">Scopes</th>
                      <th className="pb-2 pr-3 font-normal">Status</th>
                      <th className="pb-2 pr-3 font-normal">Created</th>
                      <th className="pb-2 pr-3 font-normal">Last used</th>
                      <th className="pb-2 font-normal">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key) => {
                      const status = keyStatus(key);
                      return (
                        <tr key={key.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-3 text-text">{key.name}</td>
                          <td className="py-2 pr-3">
                            <code className="text-xs text-text-muted">{key.key_prefix}…</code>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map((scope) => (
                                <Badge key={scope} tone="outline">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                          <td className="py-2 pr-3 text-text-muted">{formatDateTime(key.created_at)}</td>
                          <td className="py-2 pr-3 text-text-muted">{formatDateTime(key.last_used_at)}</td>
                          <td className="py-2">
                            {key.revoked_at ? null : (
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  disabled={busyId === key.id}
                                  onClick={() =>
                                    runKeyAction(key.id, async () => {
                                      const result = await rotateApiKeyAction(key.id);
                                      if (!result.success) return { success: false, error: result.error };
                                      setSecretModal({ name: result.data.key.name, secret: result.data.secret });
                                      return { success: true };
                                    })
                                  }
                                >
                                  Rotate
                                </Button>
                                <Button variant="secondary" disabled={busyId === key.id} onClick={() => runKeyAction(key.id, () => revokeApiKeyAction(key.id))}>
                                  Revoke
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="webhooks" className="mt-4">
          <WebhooksTab endpoints={endpoints} catalog={catalog} onChanged={load} />
        </TabPanel>

        <TabPanel value="deliveries" className="mt-4">
          <DeliveriesTab deliveries={deliveries} summary={summary} endpoints={endpoints} onChanged={load} />
        </TabPanel>

        <TabPanel value="integrations" className="mt-4">
          <IntegrationsConfigTab providers={integrations.providers} connections={integrations.connections} onChanged={load} />
        </TabPanel>

        <TabPanel value="diagnostics" className="mt-4">
          <IntegrationsDiagnosticsTab data={integrations} />
        </TabPanel>

        <TabPanel value="usage" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-text-muted">Total requests</p>
              <p className="mt-1 font-serif text-2xl font-semibold text-text">{usage.totalRequests.toLocaleString()}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-muted">Errors</p>
              <p className="mt-1 font-serif text-2xl font-semibold text-text">{usage.errorCount.toLocaleString()}</p>
            </Card>
            <Card>
              <p className="text-xs text-text-muted">Average latency</p>
              <p className="mt-1 font-serif text-2xl font-semibold text-text">{usage.averageDurationMs} ms</p>
            </Card>
          </div>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Usage by endpoint</h3>
            {usage.byEndpoint.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No requests yet" description="Usage appears here once a caller starts making requests to the Public API." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-text-muted">
                      <th className="pb-2 pr-3 font-normal">Endpoint</th>
                      <th className="pb-2 pr-3 font-normal">Requests</th>
                      <th className="pb-2 font-normal">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.byEndpoint.map((row) => (
                      <tr key={`${row.method} ${row.path}`} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 text-text">
                          <code className="text-xs">
                            {row.method} {row.path}
                          </code>
                        </td>
                        <td className="py-2 pr-3 text-text-muted">{row.count.toLocaleString()}</td>
                        <td className="py-2 text-text-muted">{row.errorCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>

        <TabPanel value="docs" className="mt-4">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Documentation</h3>
            <p className="mt-2 text-sm text-text-muted">
              The Public API guide — authentication, scopes, versioning, pagination, and error handling — lives in{" "}
              <code className="text-xs">docs/public-api.md</code>. The Webhooks guide — signing, retries, and replay — lives in{" "}
              <code className="text-xs">docs/webhooks.md</code>, with the full event catalog in <code className="text-xs">docs/webhook-events.md</code>. The machine-readable spec is served live at{" "}
              <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" className="text-accent underline">
                /api/v1/openapi.json
              </a>{" "}
              (OpenAPI 3.1, including the native <code className="text-xs">webhooks</code> section — paste it into Swagger UI or any codegen tool).
            </p>
          </Card>
        </TabPanel>
      </Tabs>

      <CreateApiKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createApiKeyAction}
        onCreated={(result: ApiKeyWithSecret) => {
          setSecretModal({ name: result.key.name, secret: result.secret });
          load();
        }}
      />

      <SecretRevealModal open={secretModal !== null} onClose={() => setSecretModal(null)} name={secretModal?.name ?? ""} secret={secretModal?.secret ?? ""} kind="API Key" />
    </div>
  );
}
