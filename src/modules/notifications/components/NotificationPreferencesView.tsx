"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { COMMUNICATION_CATEGORIES, DIGEST_FREQUENCIES } from "@/types/communication";
import type { CommunicationCategory, DigestFrequency } from "@/types/communication";
import { NOTIFICATION_PRIORITIES } from "@/core/notifications/types";
import type { NotificationPriority } from "@/core/notifications/types";
import {
  getNotificationPreferencesForCurrentMemberAction,
  updateNotificationPreferencesForCurrentMemberAction,
  getNotificationWorkspaceDefaultsAction,
  type NotificationWorkspaceDefaultsView,
} from "@/modules/notifications/notificationPlatformActions";
import type { NotificationPreferences } from "@/types/communication";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; preferences: NotificationPreferences; workspace: NotificationWorkspaceDefaultsView };

const CATEGORY_LABEL: Record<CommunicationCategory, string> = {
  crm: "CRM",
  finance: "Finance",
  operations: "Operations",
  inventory: "Inventory",
  automation: "Automation",
  ai: "Bloom AI",
  documents: "Documents",
  communication: "Communication",
};

/**
 * v2.0 Checkpoint 41, Step 15 — Preferences view at `/notifications/preferences`.
 * "Member preferences" reuses `NotificationPreferences`
 * (Checkpoint 24) unchanged — every toggle here calls the exact same
 * `mockNotificationPreferencesRepository.updatePreferences()` write path,
 * just gated on the new `notifications.preferences` permission instead of
 * `communications.view`. "Workspace preferences" and "Future integrations
 * status" are read-only here — editing workspace defaults stays on
 * `/settings` (`workspace.manage`), and integration readiness is computed,
 * not configured.
 */
export function NotificationPreferencesView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () => {
    Promise.all([getNotificationPreferencesForCurrentMemberAction(), getNotificationWorkspaceDefaultsAction()]).then(([prefsResult, workspaceResult]) => {
      if (!prefsResult.success) {
        setState({ status: "error", message: prefsResult.error });
        return;
      }
      if (!workspaceResult.success) {
        setState({ status: "error", message: workspaceResult.error });
        return;
      }
      setState({ status: "ready", preferences: prefsResult.data, workspace: workspaceResult.data });
    });
  };

  useEffect(fetchData, []);

  async function toggleCategory(category: CommunicationCategory) {
    if (state.status !== "ready") return;
    const muted = state.preferences.muted_categories.includes(category);
    const next = muted ? state.preferences.muted_categories.filter((c) => c !== category) : [...state.preferences.muted_categories, category];
    const result = await updateNotificationPreferencesForCurrentMemberAction({ mutedCategories: next });
    if (result.success) setState({ ...state, preferences: result.data });
  }

  async function setMinimumPriority(minimumPriority: NotificationPriority) {
    const result = await updateNotificationPreferencesForCurrentMemberAction({ minimumPriority });
    if (result.success && state.status === "ready") setState({ ...state, preferences: result.data });
  }

  async function setDigestFrequency(digestFrequency: DigestFrequency) {
    const result = await updateNotificationPreferencesForCurrentMemberAction({ digestFrequency });
    if (result.success && state.status === "ready") setState({ ...state, preferences: result.data });
  }

  async function setQuietHoursEnabled(enabled: boolean) {
    if (state.status !== "ready") return;
    const result = await updateNotificationPreferencesForCurrentMemberAction({ quietHours: { ...state.preferences.quiet_hours, enabled } });
    if (result.success) setState({ ...state, preferences: result.data });
  }

  async function toggleChannel(field: "desktopEnabled" | "inAppEnabled" | "emailEnabled" | "smsEnabled" | "pushEnabled", value: boolean) {
    const result = await updateNotificationPreferencesForCurrentMemberAction({ [field]: value });
    if (result.success && state.status === "ready") setState({ ...state, preferences: result.data });
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Notification Preferences" breadcrumb={[{ label: "Notifications", href: "/notifications" }, { label: "Preferences" }]} />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const { preferences, workspace } = state;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Notification Preferences" subtitle="Your own delivery rules, plus this workspace's defaults." breadcrumb={[{ label: "Notifications", href: "/notifications" }, { label: "Preferences" }]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Channels</h3>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={preferences.desktop_enabled} onChange={(e) => toggleChannel("desktopEnabled", e.target.checked)} />
              Desktop
            </label>
            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={preferences.in_app_enabled} onChange={(e) => toggleChannel("inAppEnabled", e.target.checked)} />
              In-App
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" checked={preferences.email_enabled} onChange={(e) => toggleChannel("emailEnabled", e.target.checked)} />
              Email (coming soon)
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" checked={preferences.sms_enabled} onChange={(e) => toggleChannel("smsEnabled", e.target.checked)} />
              SMS (coming soon)
            </label>
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" checked={preferences.push_enabled} onChange={(e) => toggleChannel("pushEnabled", e.target.checked)} />
              Push (coming soon)
            </label>
          </div>
        </Card>

        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Quiet hours</h3>
          <label className="mt-2 flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={preferences.quiet_hours.enabled} onChange={(e) => setQuietHoursEnabled(e.target.checked)} />
            Enabled ({preferences.quiet_hours.startHour}:00–{preferences.quiet_hours.endHour}:00)
          </label>

          <h3 className="mt-4 font-serif text-base font-semibold text-text">Priority rules</h3>
          <label htmlFor="min-priority" className="mt-2 block text-xs text-text-muted">
            Minimum priority to notify on
          </label>
          <select
            id="min-priority"
            value={preferences.minimum_priority}
            onChange={(e) => setMinimumPriority(e.target.value as NotificationPriority)}
            className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
          >
            {NOTIFICATION_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <h3 className="mt-4 font-serif text-base font-semibold text-text">Digest frequency</h3>
          <select value={preferences.digest_frequency} onChange={(e) => setDigestFrequency(e.target.value as DigestFrequency)} className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text">
            {DIGEST_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Card>

        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Categories</h3>
          <p className="mt-1 text-xs text-text-muted">Muted categories still appear in the Notification Center — they just skip desktop alerts.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {COMMUNICATION_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${preferences.muted_categories.includes(c) ? "bg-surface-hover text-text-muted line-through" : "bg-accent text-accent-foreground"}`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Workspace defaults</h3>
          <p className="mt-1 text-xs text-text-muted">Set by an admin on Settings → Notifications. Your own toggles above narrow these, never widen them.</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-text-muted">Email enabled workspace-wide</dt>
              <dd className="text-text">{workspace.workspaceDefaults.emailEnabled ? "Yes" : "No"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-text-muted">Push enabled workspace-wide</dt>
              <dd className="text-text">{workspace.workspaceDefaults.pushEnabled ? "Yes" : "No"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-text-muted">Default digest frequency</dt>
              <dd className="text-text capitalize">{workspace.workspaceDefaults.digestFrequency}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-text-muted">Critical alerts bypass digest</dt>
              <dd className="text-text">{workspace.workspaceDefaults.criticalAlertsBypassDigest ? "Yes" : "No"}</dd>
            </div>
          </dl>

          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Future integrations status</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {workspace.channelReadiness.map((r) => (
              <li key={r.channel} className="flex items-center justify-between gap-2">
                <span className="text-text capitalize">{r.channel.replace(/_/g, " ")}</span>
                <Badge tone={r.configured ? "success" : "neutral"}>{r.configured ? "Ready" : "Not configured"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
