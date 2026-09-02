"use client";

import { useEffect, useState } from "react";
import { getNotificationPreferencesAction, updateNotificationPreferencesAction } from "@/modules/communication/preferences/preferencesActions";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { COMMUNICATION_CATEGORIES, DIGEST_FREQUENCIES } from "@/types/communication";
import type { NotificationPreferences, CommunicationCategory, DigestFrequency } from "@/types/communication";
import type { NotificationPriority } from "@/core/notifications/types";
import { NOTIFICATION_PRIORITIES } from "@/core/notifications/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; preferences: NotificationPreferences };

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
 * v2.0 Checkpoint 24, Step 3 — Notification Preferences. Every toggle saves
 * immediately on change (no separate "Save" button) — the same pattern
 * Settings' own per-field toggles already use. Email/SMS/Push toggles are
 * real, stored preferences, but have no effect on delivery today (no
 * provider registered) — labeled "(coming soon)" rather than hidden, so
 * they're ready the moment a provider is registered.
 */
export function NotificationPreferencesPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () => {
    getNotificationPreferencesAction().then((result) => {
      if (result.success) setState({ status: "ready", preferences: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchData, []);

  async function toggleCategory(category: CommunicationCategory) {
    if (state.status !== "ready") return;
    const muted = state.preferences.muted_categories.includes(category);
    const next = muted ? state.preferences.muted_categories.filter((c) => c !== category) : [...state.preferences.muted_categories, category];
    const result = await updateNotificationPreferencesAction({ mutedCategories: next });
    if (result.success) setState({ status: "ready", preferences: result.data });
  }

  async function setMinimumPriority(minimumPriority: NotificationPriority) {
    const result = await updateNotificationPreferencesAction({ minimumPriority });
    if (result.success) setState({ status: "ready", preferences: result.data });
  }

  async function setDigestFrequency(digestFrequency: DigestFrequency) {
    const result = await updateNotificationPreferencesAction({ digestFrequency });
    if (result.success) setState({ status: "ready", preferences: result.data });
  }

  async function setQuietHoursEnabled(enabled: boolean) {
    if (state.status !== "ready") return;
    const result = await updateNotificationPreferencesAction({ quietHours: { ...state.preferences.quiet_hours, enabled } });
    if (result.success) setState({ status: "ready", preferences: result.data });
  }

  async function toggleChannel(field: "desktopEnabled" | "inAppEnabled" | "emailEnabled" | "smsEnabled" | "pushEnabled", value: boolean) {
    const result = await updateNotificationPreferencesAction({ [field]: value });
    if (result.success) setState({ status: "ready", preferences: result.data });
  }

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const { preferences } = state;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text">Channels</h3>
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
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text">Quiet hours</h3>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={preferences.quiet_hours.enabled} onChange={(e) => setQuietHoursEnabled(e.target.checked)} />
            Enabled ({preferences.quiet_hours.startHour}:00–{preferences.quiet_hours.endHour}:00)
          </label>
        </section>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-text">Categories</h3>
        <p className="text-xs text-text-muted">Muted categories still appear in the Notification Center — they just skip desktop alerts.</p>
        {/* Not a single-select view switch — every category can be toggled independently — so this stays a set of toggle buttons rather than the shared `Tabs` primitive. Restyled to match the Tab's own selected/unselected visual language (border-accent + text-accent when on) instead of the old filled-pill treatment. */}
        <div className="flex flex-wrap gap-x-1 gap-y-2 overflow-x-auto sm:gap-x-2">
          {COMMUNICATION_CATEGORIES.map((c) => {
            const muted = preferences.muted_categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={!muted}
                onClick={() => toggleCategory(c)}
                className={`shrink-0 rounded-md border-b-2 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 ${
                  muted ? "border-transparent text-text-muted line-through hover:text-text" : "border-accent text-accent"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text">Priority rules</h3>
          <label htmlFor="min-priority" className="text-xs text-text-muted">
            Minimum priority to notify on
          </label>
          <select
            id="min-priority"
            value={preferences.minimum_priority}
            onChange={(e) => setMinimumPriority(e.target.value as NotificationPriority)}
            className="block w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text sm:max-w-xs"
          >
            {NOTIFICATION_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-text">Digest frequency</h3>
          <select
            value={preferences.digest_frequency}
            onChange={(e) => setDigestFrequency(e.target.value as DigestFrequency)}
            className="block w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text sm:max-w-xs"
          >
            {DIGEST_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </section>
      </div>
    </div>
  );
}
