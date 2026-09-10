"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  beginProviderOAuthConnectionAction,
  disconnectOAuthProviderAction,
  getOwnProviderConnectionAction,
  refreshProviderOAuthConnectionAction,
} from "@/modules/integrations/manageOAuthConnectionActions";
import { getOwnGmailMailboxSummaryAction, syncMyGmailMailboxAction, type GmailMailboxSummary } from "@/modules/integrations/gmail/syncGmailMailboxAction";
import { CONNECTION_STATE_LABELS } from "@/core/integrations/types";
import type { ConnectionState, IntegrationConnection } from "@/core/integrations/types";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready" };

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

const CALLBACK_PATH = "/api/integrations/oauth/callback";

/**
 * GMAIL-03R2 — the minimal Gmail connection-management surface, mirroring
 * `StripeConnectPanel.tsx`'s own shape (its own dedicated real-provider
 * panel, not the generic Configuration Center table). Unlike Stripe's
 * paste-a-secret flow, Gmail's real Connect action is a genuine browser
 * redirect to Google, then back through the generic OAuth callback route
 * (`/api/integrations/oauth/callback`) — this panel only ever starts that
 * redirect and re-reads canonical connection state after the fact; it
 * never handles a `code`/`state` itself. Deliberately never shows a
 * connected Google account's email/profile — that identity is
 * intentionally deferred (no `openid`/`email`/`profile` scope requested).
 */
/** Derives the one-time inline message a callback redirect left in the URL — computed once as lazy initial state rather than an effect, since there's nothing here to keep synchronized after mount. */
function initialCallbackMessage(searchParams: URLSearchParams): { tone: "error" | "success"; text: string } | null {
  const status = searchParams.get("integration_status");
  const detail = searchParams.get("integration_detail");
  if (!status || detail !== "gmail") return null;
  if (status === "connected") return { tone: "success", text: "Gmail connected — verified with a real Google call." };
  if (status === "pending_configuration") return { tone: "error", text: "Gmail isn't configured in this environment yet." };
  if (status === "error") return { tone: "error", text: "Could not connect Gmail — the request may have expired. Try again." };
  return null;
}

export function GmailConnectPanel() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [connection, setConnection] = useState<IntegrationConnection | null>(null);
  const [mailboxSummary, setMailboxSummary] = useState<GmailMailboxSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(() => initialCallbackMessage(searchParams));

  const load = () => {
    setState({ status: "loading" });
    Promise.all([getOwnProviderConnectionAction("gmail"), getOwnGmailMailboxSummaryAction()]).then(([connectionResult, summaryResult]) => {
      if (!connectionResult.success) {
        setState({ status: "error" });
        return;
      }
      setConnection(connectionResult.data);
      setMailboxSummary(summaryResult.success ? summaryResult.data : null);
      setState({ status: "ready" });
    });
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOwnProviderConnectionAction("gmail"), getOwnGmailMailboxSummaryAction()]).then(([connectionResult, summaryResult]) => {
      if (cancelled) return;
      if (!connectionResult.success) {
        setState({ status: "error" });
        return;
      }
      setConnection(connectionResult.data);
      setMailboxSummary(summaryResult.success ? summaryResult.data : null);
      setState({ status: "ready" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
    const result = await beginProviderOAuthConnectionAction("gmail", redirectUri);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    window.location.href = result.data.authorizationUrl;
  };

  const disconnect = async () => {
    if (!connection) return;
    setBusy(true);
    setMessage(null);
    const result = await disconnectOAuthProviderAction(connection.id);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    load();
  };

  const refresh = async () => {
    if (!connection) return;
    setBusy(true);
    setMessage(null);
    const result = await refreshProviderOAuthConnectionAction(connection.id);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      load();
      return;
    }
    setMessage({ tone: "success", text: "Gmail's connection was refreshed." });
    load();
  };

  const syncNow = async () => {
    setBusy(true);
    setMessage(null);
    const result = await syncMyGmailMailboxAction();
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: "Sync failed — try again shortly." });
      load();
      return;
    }
    if (result.data.status === "reconnect_required") {
      setMessage({ tone: "error", text: "Gmail needs to be reconnected before syncing can continue." });
    } else if (result.data.status === "success") {
      setMessage({ tone: "success", text: `Synced ${result.data.threadsProcessed} thread${result.data.threadsProcessed === 1 ? "" : "s"}.` });
    }
    load();
  };

  if (state.status === "loading") {
    return (
      <Card>
        <p className="text-sm text-text-muted">Loading Gmail connection…</p>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <p className="text-sm text-text-muted">Gmail&rsquo;s connection isn&rsquo;t available right now.</p>
        <Button className="mt-3" variant="secondary" onClick={load}>
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-[17px] font-semibold text-text">Gmail</h3>
          <p className="mt-1 text-xs text-text-muted">Send approved Communication Template emails through your own connected Gmail account — only you can manage this connection.</p>
        </div>
        {connection ? <Badge tone={STATE_TONE[connection.state]}>{CONNECTION_STATE_LABELS[connection.state]}</Badge> : <Badge tone="neutral">Not connected</Badge>}
      </div>

      {message ? (
        <div
          role="alert"
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${message.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"}`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!connection || connection.state === "disconnected" || connection.state === "failed" ? (
          <Button disabled={busy} onClick={connect}>
            {busy ? "Connecting…" : connection?.state === "failed" ? "Try again" : "Connect Gmail"}
          </Button>
        ) : connection.state === "connecting" ? (
          <Button disabled variant="secondary">
            Connecting…
          </Button>
        ) : connection.state === "expired" ? (
          <Button disabled={busy} onClick={refresh}>
            {busy ? "Reconnecting…" : "Reconnect Gmail"}
          </Button>
        ) : (
          <Button variant="secondary" disabled={busy} onClick={disconnect}>
            Disconnect Gmail
          </Button>
        )}
        {connection?.state === "connected" ? (
          <Button variant="secondary" disabled={busy} onClick={syncNow}>
            {busy ? "Syncing…" : "Sync now"}
          </Button>
        ) : null}
      </div>

      {connection?.state === "connected" ? (
        <p className="mt-3 text-xs text-text-muted">{mailboxSummary?.lastSyncedAt ? `Last synced ${new Date(mailboxSummary.lastSyncedAt).toLocaleString()}` : "Never synced yet."}</p>
      ) : null}
    </Card>
  );
}
