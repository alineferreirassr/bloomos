"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  beginProviderOAuthConnectionAction,
  disconnectOAuthProviderAction,
  getOwnProviderConnectionAction,
  refreshProviderOAuthConnectionAction,
} from "@/modules/integrations/manageOAuthConnectionActions";
import {
  getMyGoogleCalendarsAction,
  getOwnGoogleCalendarAccountSummaryAction,
  identifyMyGoogleCalendarAccountAction,
  listMyGoogleCalendarsAction,
  setMyGoogleCalendarSelectedAction,
  syncMyGoogleCalendarEventsAction,
  type GoogleCalendarAccountSummary,
  type GoogleCalendarSummary,
} from "@/modules/integrations/googleCalendarReadonly/googleCalendarAccountActions";
import { CONNECTION_STATE_LABELS } from "@/core/integrations/types";
import type { ConnectionState, IntegrationConnection } from "@/core/integrations/types";

const PROVIDER_ID = "google-calendar-readonly";
const CALLBACK_PATH = "/api/integrations/oauth/callback";

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

/** Mirrors `GmailConnectPanel.tsx`'s own lazy-initial-state derivation of a one-time callback message, scoped to this provider only. */
function initialCallbackMessage(searchParams: URLSearchParams): { tone: "error" | "success"; text: string } | null {
  const status = searchParams.get("integration_status");
  const detail = searchParams.get("integration_detail");
  if (!status || detail !== PROVIDER_ID) return null;
  if (status === "connected") return { tone: "success", text: "Google Calendar connected." };
  if (status === "pending_configuration") return { tone: "error", text: "Google Calendar isn't configured in this environment yet." };
  if (status === "error") return { tone: "error", text: "Could not connect Google Calendar — the request may have expired. Try again." };
  return null;
}

function calendarLabel(calendar: GoogleCalendarSummary): string {
  return calendar.summary && calendar.summary.trim().length > 0 ? calendar.summary : "Untitled calendar";
}

interface GoogleCalendarPanelData {
  connection: IntegrationConnection | null;
  accountSummary: GoogleCalendarAccountSummary | null;
  calendars: GoogleCalendarSummary[];
}

/**
 * A pure, module-level data fetcher — no closure over any component state
 * setter — so both the mount effect and the `load()` function used by
 * button handlers can share this one fetch sequence without either being
 * flagged for calling setState from inside an effect (React's own
 * `react-hooks/set-state-in-effect` rule traces locally-defined functions
 * that call a setter; a function with no such closure can't trigger it).
 * Returns `null` only when the connection read itself failed — every other
 * "why is this empty" case (not connected, not yet identified, no
 * calendars loaded) resolves to real data with empty/null fields, exactly
 * matching `googleCalendarEventCalendarSource.ts`'s own "graceful empty,
 * never a special error state" philosophy for this same domain.
 */
async function fetchGoogleCalendarPanelData(): Promise<GoogleCalendarPanelData | null> {
  const connectionResult = await getOwnProviderConnectionAction(PROVIDER_ID);
  if (!connectionResult.success) return null;

  const connection = connectionResult.data;
  if (connection?.state !== "connected") {
    return { connection, accountSummary: null, calendars: [] };
  }

  let summaryResult = await getOwnGoogleCalendarAccountSummaryAction();
  if (summaryResult.success && summaryResult.data === null) {
    // Connected but never identified yet — identify once, automatically. A later call with an already-identified account never re-runs this.
    const identifyResult = await identifyMyGoogleCalendarAccountAction();
    if (identifyResult.success) summaryResult = await getOwnGoogleCalendarAccountSummaryAction();
  }
  const accountSummary = summaryResult.success ? summaryResult.data : null;

  const calendarsResult = await getMyGoogleCalendarsAction();
  const calendars = calendarsResult.success ? calendarsResult.data : [];

  return { connection, accountSummary, calendars };
}

/**
 * GC02-02 — the Google Calendar (read-only) connection, account status,
 * calendar-selection, and manual-sync management surface, structurally
 * mirroring `GmailConnectPanel.tsx` (same generic OAuth begin/disconnect/
 * refresh actions, same connection-state vocabulary) but targeting only
 * the member-owned `google-calendar-readonly` provider — never the
 * pre-existing, workspace-owned, write-capable `google-calendar` provider.
 *
 * This component never calls the Google API directly, never handles a
 * token, and never triggers sync on mount or on a selection change — every
 * provider operation flows through the existing Server Actions (GCAL-02–06
 * plus this checkpoint's one new `setMyGoogleCalendarSelectedAction`).
 * Account identification is the one exception explicitly authorized to run
 * automatically, once, when a connection exists but has never been
 * identified yet (see `load()` below) — every other provider call (listing
 * calendars for the first time, syncing events) is a plain, explicit
 * button the member presses themselves.
 */
export function GoogleCalendarSettingsPanel() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [connection, setConnection] = useState<IntegrationConnection | null>(null);
  const [accountSummary, setAccountSummary] = useState<GoogleCalendarAccountSummary | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingCalendarIds, setPendingCalendarIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(() => initialCallbackMessage(searchParams));

  function applyPanelData(data: GoogleCalendarPanelData | null) {
    if (data === null) {
      setState({ status: "error" });
      return;
    }
    setConnection(data.connection);
    setAccountSummary(data.accountSummary);
    setCalendars(data.calendars);
    setState({ status: "ready" });
  }

  const load = async () => {
    setState({ status: "loading" });
    applyPanelData(await fetchGoogleCalendarPanelData());
  };

  useEffect(() => {
    let cancelled = false;
    fetchGoogleCalendarPanelData().then((data) => {
      if (cancelled) return;
      applyPanelData(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
    const result = await beginProviderOAuthConnectionAction(PROVIDER_ID, redirectUri);
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
    await load();
  };

  const reconnect = async () => {
    if (!connection) return;
    setBusy(true);
    setMessage(null);
    const result = await refreshProviderOAuthConnectionAction(connection.id);
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      await load();
      return;
    }
    setMessage({ tone: "success", text: "Google Calendar's connection was refreshed." });
    await load();
  };

  const refreshCalendarList = async () => {
    setBusy(true);
    setMessage(null);
    const result = await listMyGoogleCalendarsAction();
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: "Could not load your calendars — try again shortly." });
      return;
    }
    if (result.data.status !== "success") {
      setMessage({ tone: "error", text: "Google Calendar needs to be reconnected before its calendar list can be loaded." });
    }
    await load();
  };

  const syncNow = async () => {
    setBusy(true);
    setMessage(null);
    const result = await syncMyGoogleCalendarEventsAction();
    setBusy(false);
    if (!result.success) {
      setMessage({ tone: "error", text: "Sync failed — try again shortly." });
      return;
    }
    if (result.data.status === "no_selected_calendars") {
      setMessage({ tone: "error", text: "No calendars are selected to sync — choose at least one calendar below." });
    } else if (result.data.status === "reconnect_required") {
      setMessage({ tone: "error", text: "Google Calendar needs to be reconnected before syncing can continue." });
    } else if (result.data.status === "no_connection") {
      setMessage({ tone: "error", text: "Google Calendar isn't connected." });
    } else if (result.data.status === "error") {
      setMessage({ tone: "error", text: "Sync couldn't complete — try again shortly." });
    } else if (result.data.status === "success") {
      const outcomes = result.data.results;
      const needsAttention = outcomes.filter((outcome) => outcome.status === "error" || outcome.status === "reconnect_required").length;
      const incomplete = outcomes.filter((outcome) => outcome.status === "incomplete").length;
      if (needsAttention > 0) {
        setMessage({ tone: "error", text: `Synced with issues — ${needsAttention} calendar${needsAttention === 1 ? "" : "s"} need${needsAttention === 1 ? "s" : ""} attention.` });
      } else if (incomplete > 0) {
        setMessage({ tone: "success", text: `Sync is still catching up on ${incomplete} calendar${incomplete === 1 ? "" : "s"} — run Sync now again shortly.` });
      } else {
        setMessage({ tone: "success", text: `Synced ${outcomes.length} calendar${outcomes.length === 1 ? "" : "s"}.` });
      }
    }
    await load();
  };

  const toggleCalendar = async (calendarId: string, nextSelected: boolean) => {
    if (pendingCalendarIds.has(calendarId)) return;
    setPendingCalendarIds((prev) => new Set(prev).add(calendarId));
    setMessage(null);
    const result = await setMyGoogleCalendarSelectedAction(calendarId, nextSelected);
    setPendingCalendarIds((prev) => {
      const next = new Set(prev);
      next.delete(calendarId);
      return next;
    });
    if (!result.success) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setCalendars((prev) => prev.map((calendar) => (calendar.id === calendarId ? result.data : calendar)));
  };

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Google Calendar"
          actions={
            <Link href="/settings" className="text-sm text-accent underline">
              Back to Settings
            </Link>
          }
        />
        <Card>
          <p className="text-sm text-text-muted">Google Calendar&rsquo;s connection isn&rsquo;t available right now.</p>
          <Button className="mt-3" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const isConnected = connection?.state === "connected";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Google Calendar"
        subtitle="Connect your personal Google Calendar to display selected calendars inside BloomOS."
        actions={
          <Link href="/settings" className="text-sm text-accent underline">
            Back to Settings
          </Link>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-[17px] font-semibold text-text">Connection</h3>
            <p className="mt-1 text-xs text-text-muted">Only you can manage your own Google Calendar connection — it never affects other Workspace members.</p>
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

        {isConnected && accountSummary?.providerAccountEmail ? (
          <p className="mt-3 text-xs text-text-muted">
            Connected as: <span className="text-text">{accountSummary.providerAccountEmail}</span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {!connection || connection.state === "disconnected" || connection.state === "failed" ? (
            <Button disabled={busy} onClick={() => void connect()}>
              {busy ? "Connecting…" : connection?.state === "failed" ? "Try again" : "Connect Google Calendar"}
            </Button>
          ) : connection.state === "connecting" ? (
            <Button disabled variant="secondary">
              Connecting…
            </Button>
          ) : connection.state === "expired" ? (
            <Button disabled={busy} onClick={() => void reconnect()}>
              {busy ? "Reconnecting…" : "Reconnect Google Calendar"}
            </Button>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          )}
          {isConnected ? (
            <Button variant="secondary" disabled={busy} onClick={() => void syncNow()}>
              {busy ? "Syncing…" : "Sync now"}
            </Button>
          ) : null}
        </div>
      </Card>

      {isConnected ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-[17px] font-semibold text-text">Calendars</h3>
              <p className="mt-1 text-xs text-text-muted">Choose which of your Google calendars display and sync inside BloomOS.</p>
            </div>
            <Button variant="secondary" disabled={busy} onClick={() => void refreshCalendarList()}>
              {busy ? "Loading…" : "Refresh calendars"}
            </Button>
          </div>

          {calendars.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No calendars loaded yet" description="Refresh to load your Google calendars." />
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {calendars.map((calendar) => {
                const fieldId = `google-calendar-${calendar.id}`;
                const pending = pendingCalendarIds.has(calendar.id);
                return (
                  <li key={calendar.id} className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2">
                    <Checkbox
                      id={fieldId}
                      checked={calendar.isSelected}
                      disabled={pending}
                      onChange={(event) => void toggleCalendar(calendar.id, event.target.checked)}
                    />
                    <label htmlFor={fieldId} className="flex-1 text-sm text-text">
                      {calendarLabel(calendar)}
                    </label>
                    {calendar.isPrimary ? <Badge tone="outline">Primary</Badge> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
