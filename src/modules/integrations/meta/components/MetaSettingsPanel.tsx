"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { beginProviderOAuthConnectionAction, disconnectOAuthProviderAction, getOwnProviderConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { discoverMetaAccountsAction, getSelectedMetaPublishingIdentityAction, selectMetaPublishingIdentityAction, type MetaSelectedIdentity } from "@/modules/integrations/meta/metaAccountActions";
import type { MetaPageSummary } from "@/core/integrations/providers/meta/metaProvider";
import type { IntegrationConnection } from "@/core/integrations/types";

const PROVIDER_ID = "meta";
const CALLBACK_PATH = "/api/integrations/oauth/callback";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready" };

/**
 * SOCIAL02-W — a truthful, derived connection-health label. A successful
 * OAuth token exchange (`connection.state === "connected"`) does NOT by
 * itself mean Instagram publishing is usable — that additionally requires
 * a discoverable Page with a linked Instagram professional account. This
 * never fabricates a "ready" state from OAuth success alone.
 */
type MetaHealth = "not_connected" | "reconnect_required" | "no_pages" | "no_instagram" | "ready";

function computeHealth(connection: IntegrationConnection | null, pages: MetaPageSummary[] | null, discoverError: string | null): MetaHealth {
  if (!connection || connection.state !== "connected") return "not_connected";
  if (discoverError) return "reconnect_required";
  if (pages === null) return "not_connected"; // not yet discovered this session
  if (pages.length === 0) return "no_pages";
  if (!pages.some((page) => page.instagramAccountId)) return "no_instagram";
  return "ready";
}

const HEALTH_LABEL: Record<MetaHealth, string> = {
  not_connected: "Not connected",
  reconnect_required: "Reconnect required",
  no_pages: "No eligible Facebook Page found",
  no_instagram: "No eligible Instagram account found",
  ready: "Instagram publishing identity available",
};

const HEALTH_TONE: Record<MetaHealth, BadgeTone> = {
  not_connected: "neutral",
  reconnect_required: "danger",
  no_pages: "warning",
  no_instagram: "warning",
  ready: "success",
};

interface MetaPanelData {
  connection: IntegrationConnection | null;
  selected: MetaSelectedIdentity | null;
  pages: MetaPageSummary[] | null;
  discoverError: string | null;
}

/**
 * A pure, module-level data fetcher — no closure over any component state
 * setter — mirroring `GoogleCalendarSettingsPanel.tsx`'s own identical
 * `fetchGoogleCalendarPanelData` split (see its doc comment): lets both
 * the mount effect and button handlers share this one fetch sequence
 * without either being flagged by `react-hooks/set-state-in-effect`,
 * which traces locally-defined functions that call a setter — a function
 * with no such closure can't trigger it. Returns `null` only when the
 * connection read itself failed.
 */
async function fetchMetaPanelData(): Promise<MetaPanelData | null> {
  const [connectionResult, selectedResult] = await Promise.all([getOwnProviderConnectionAction(PROVIDER_ID), getSelectedMetaPublishingIdentityAction()]);
  if (!connectionResult.success) return null;

  const connection = connectionResult.data;
  const selected = selectedResult.success ? selectedResult.data : null;
  if (connection?.state !== "connected") return { connection, selected, pages: null, discoverError: null };

  const discovered = await discoverMetaAccountsAction();
  return { connection, selected, pages: discovered.success ? discovered.data : null, discoverError: discovered.success ? null : discovered.error };
}

function initialCallbackMessage(searchParams: URLSearchParams): { tone: "error" | "success"; text: string } | null {
  const status = searchParams.get("integration_status");
  const detail = searchParams.get("integration_detail");
  if (!status || detail !== PROVIDER_ID) return null;
  if (status === "connected") return { tone: "success", text: "Meta connected." };
  if (status === "pending_configuration") return { tone: "error", text: "Meta isn't configured in this environment yet." };
  if (status === "error") return { tone: "error", text: "Could not connect Meta — the request may have expired. Try again." };
  return null;
}

/**
 * SOCIAL-02 — Meta account/provider foundation surface: connect/disconnect
 * (generic OAuth actions, unchanged from every other provider), then
 * Facebook Page + linked Instagram professional account discovery and
 * selection (Meta-specific). No publishing UI — that's SOCIAL-03's, once
 * a real Social content domain exists to publish from.
 */
export function MetaSettingsPanel() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [connection, setConnection] = useState<IntegrationConnection | null>(null);
  const [pages, setPages] = useState<MetaPageSummary[] | null>(null);
  const [selected, setSelected] = useState<MetaSelectedIdentity | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [callbackMessage, setCallbackMessage] = useState(() => initialCallbackMessage(searchParams));

  function applyPanelData(data: MetaPanelData | null) {
    if (!data) {
      setState({ status: "error" });
      return;
    }
    setConnection(data.connection);
    setSelected(data.selected);
    setPages(data.pages);
    setDiscoverError(data.discoverError);
    setState({ status: "ready" });
  }

  function reload() {
    fetchMetaPanelData().then(applyPanelData);
  }

  useEffect(() => {
    fetchMetaPanelData().then(applyPanelData);
  }, []);

  async function handleConnect() {
    setBusy(true);
    setCallbackMessage(null);
    const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
    const result = await beginProviderOAuthConnectionAction(PROVIDER_ID, redirectUri);
    setBusy(false);
    if (result.success) {
      window.location.href = result.data.authorizationUrl;
      return;
    }
    setCallbackMessage({ tone: "error", text: result.error });
  }

  async function handleDisconnect() {
    if (!connection) return;
    setBusy(true);
    const result = await disconnectOAuthProviderAction(connection.id);
    setBusy(false);
    if (result.success) {
      setPages(null);
      setSelected(null);
      reload();
    } else {
      setCallbackMessage({ tone: "error", text: result.error });
    }
  }

  async function handleRefreshPages() {
    setBusy(true);
    setDiscoverError(null);
    const result = await discoverMetaAccountsAction();
    setBusy(false);
    if (result.success) setPages(result.data);
    else setDiscoverError(result.error);
  }

  async function handleSelect(page: MetaPageSummary) {
    setBusy(true);
    const result = await selectMetaPublishingIdentityAction({ id: page.id });
    setBusy(false);
    if (result.success) setSelected(result.data);
    else setCallbackMessage({ tone: "error", text: result.error });
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this connection." onRetry={reload} />;
  }

  const health = computeHealth(connection, pages, discoverError);
  const isConnected = connection?.state === "connected";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Meta" subtitle="Connect Amoré Bloom's Facebook Page and its linked Instagram professional account." />

      {callbackMessage ? (
        <Card>
          <p className={callbackMessage.tone === "error" ? "text-sm text-rose-600 dark:text-rose-400" : "text-sm text-emerald-600 dark:text-emerald-400"}>{callbackMessage.text}</p>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-serif text-[17px] font-semibold text-text">Meta connection</h3>
            <Badge tone={HEALTH_TONE[health]}>{HEALTH_LABEL[health]}</Badge>
          </div>
          {isConnected ? (
            <Button variant="secondary" onClick={handleDisconnect} disabled={busy}>
              {busy ? "Disconnecting…" : "Disconnect"}
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={busy}>
              {busy ? "Connecting…" : "Connect Meta"}
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Instagram is the primary publishing target for future checkpoints; the linked Facebook Page is required Meta account infrastructure, not a
          separate publishing surface on its own.
        </p>
      </Card>

      {isConnected ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-[17px] font-semibold text-text">Facebook Pages</h3>
            <Button variant="secondary" onClick={handleRefreshPages} disabled={busy}>
              {busy ? "Checking…" : "Refresh Pages"}
            </Button>
          </div>

          {discoverError ? (
            <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">
              {discoverError}
            </p>
          ) : null}

          {pages === null && !discoverError ? (
            <Skeleton className="mt-3 h-16 w-full" />
          ) : pages && pages.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No Facebook Pages were found for this Meta account. Confirm the connecting account has a role on a Page.</p>
          ) : pages ? (
            <ul className="mt-3 flex flex-col gap-2">
              {pages.map((page) => {
                const isSelected = selected?.pageId === page.id;
                return (
                  <li key={page.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-text">{page.name}</p>
                      <p className="text-xs text-text-muted">{page.instagramUsername ? `Instagram: @${page.instagramUsername}` : "No linked Instagram professional account"}</p>
                    </div>
                    {isSelected ? (
                      <Badge tone="success">Selected</Badge>
                    ) : (
                      <Button variant="secondary" onClick={() => handleSelect(page)} disabled={busy || !page.instagramAccountId} title={!page.instagramAccountId ? "This Page has no linked Instagram professional account." : undefined}>
                        Select
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
