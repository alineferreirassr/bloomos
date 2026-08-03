"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import {
  connectStripeAction,
  disconnectStripeAction,
  getStripeConnectionAction,
  reconnectStripeAction,
  testStripeConnectionAction,
  type StripeMode,
} from "@/modules/integrations/stripe/connectStripeActions";
import { CONNECTION_STATE_LABELS } from "@/core/integrations/types";
import type { ConnectionState } from "@/core/integrations/types";

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

/**
 * The Stripe Connection Flow (v2 Checkpoint 23, Step 2) — a dedicated
 * panel, not the generic Configuration Center connection row Checkpoint
 * 22 built for infrastructure-only providers. Stripe is BloomOS's first
 * *real* provider: "Connect" here makes a genuine Stripe API call before
 * ever transitioning the Connection State Machine, and a rejected key is
 * never persisted. The workspace member pastes their own secret key —
 * this component never receives one from anywhere else.
 */
export function StripeConnectPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState | null>(null);
  const [mode, setMode] = useState<StripeMode>("sandbox");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = () => {
    setState({ status: "loading" });
    getStripeConnectionAction().then((result) => {
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      setConnectionId(result.data.connection?.id ?? null);
      setConnectionState(result.data.connection?.state ?? null);
      if (result.data.mode) setMode(result.data.mode);
      setState({ status: "ready" });
    });
  };

  useEffect(() => {
    let cancelled = false;
    getStripeConnectionAction().then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      setConnectionId(result.data.connection?.id ?? null);
      setConnectionState(result.data.connection?.state ?? null);
      if (result.data.mode) setMode(result.data.mode);
      setState({ status: "ready" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    const result = await connectStripeAction(secret, mode);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setSecret("");
    setMessage({ tone: "success", text: "Connected — verified with a real Stripe API call." });
    load();
  };

  const testConnection = async () => {
    if (!connectionId) return;
    setBusy(true);
    setMessage(null);
    const result = await testStripeConnectionAction(connectionId);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setMessage(result.data.ok ? { tone: "success", text: `Connection healthy — ${result.data.latencyMs}ms.` } : { tone: "error", text: result.data.error ?? "Connection test failed." });
    load();
  };

  const disconnect = async () => {
    if (!connectionId) return;
    setBusy(true);
    setMessage(null);
    const result = await disconnectStripeAction(connectionId);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    load();
  };

  const reconnect = async () => {
    if (!connectionId) return;
    setBusy(true);
    setMessage(null);
    const result = await reconnectStripeAction(connectionId);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    load();
  };

  if (state.status === "loading") {
    return (
      <Card>
        <p className="text-sm text-text-muted">Loading Stripe connection…</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-[17px] font-semibold text-text">Stripe</h3>
          <p className="mt-1 text-xs text-text-muted">The central payment engine — Customers, Checkout, Invoices, Payment Links, and Refunds, verified against a real Stripe account.</p>
        </div>
        {connectionState ? <Badge tone={STATE_TONE[connectionState]}>{CONNECTION_STATE_LABELS[connectionState]}</Badge> : <Badge tone="neutral">Not connected</Badge>}
      </div>

      {message ? (
        <div
          role="alert"
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${message.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"}`}
        >
          {message.text}
        </div>
      ) : null}

      {connectionState === "connected" || connectionState === "connecting" || connectionState === "refreshing" || connectionState === "reconnecting" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={testConnection}>
            Test Connection
          </Button>
          <Button variant="secondary" disabled={busy} onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      ) : connectionState === "disabled" || connectionState === "failed" || connectionState === "expired" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={reconnect}>
            Reconnect
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <FormField label="Environment" htmlFor="stripe-mode">
            <Select id="stripe-mode" value={mode} onChange={(event) => setMode(event.target.value as StripeMode)}>
              <option value="sandbox">Sandbox (test mode)</option>
              <option value="production">Production (live)</option>
            </Select>
          </FormField>
          <FormField label="Stripe secret key" htmlFor="stripe-secret" hint="Never stored in plaintext — encrypted immediately through the Credentials Manager.">
            <Input id="stripe-secret" type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={mode === "sandbox" ? "sk_test_…" : "sk_live_…"} />
          </FormField>
          <Button disabled={busy || secret.trim().length === 0} onClick={connect}>
            {busy ? "Connecting…" : "Connect"}
          </Button>
        </div>
      )}
    </Card>
  );
}
