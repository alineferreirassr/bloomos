"use client";

import { useEffect, useState } from "react";
import { getClientPortalProfileAction, updateClientPortalPreferencesAction, type ClientPortalProfile } from "@/modules/clientPortal/getClientPortalProfile";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type SettingsState = { status: "loading" } | { status: "error" } | { status: "ready"; profile: ClientPortalProfile };

/**
 * Checkpoint 36, Step 12 — Portal Settings. Reuses the exact same
 * `client_portal_preferences` store Step 11's Profile Center already
 * built (`getClientPortalProfileAction`/`updateClientPortalPreferencesAction`)
 * for Theme/Timezone/Notification Settings — never a second preferences
 * model. "Language" is the spec's own named placeholder (disabled — no
 * i18n exists yet). "Privacy" is informational, describing what data this
 * portal reads and who can see it, rather than a working data-export/
 * deletion tool (no such backend exists this checkpoint).
 */
export function ClientPortalSettingsView() {
  const [state, setState] = useState<SettingsState>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [timezoneDraft, setTimezoneDraft] = useState("");

  const fetchProfile = () =>
    getClientPortalProfileAction().then((result) => {
      if (result.success) {
        setState({ status: "ready", profile: result.data });
        setTimezoneDraft(result.data.portalPreferences.timezone ?? "");
      } else setState({ status: "error" });
    });

  useEffect(() => {
    fetchProfile();

  }, []);

  async function handleThemeChange(theme: "light" | "dark" | "system") {
    setSaving(true);
    const result = await updateClientPortalPreferencesAction({ theme });
    setSaving(false);
    if (result.success) fetchProfile();
  }

  async function handleTimezoneSave() {
    setSaving(true);
    const result = await updateClientPortalPreferencesAction({ timezone: timezoneDraft.trim() || null });
    setSaving(false);
    if (result.success) fetchProfile();
  }

  async function handleNotificationToggle(field: "emailNotificationsEnabled" | "smsNotificationsEnabled", value: boolean) {
    setSaving(true);
    const result = await updateClientPortalPreferencesAction({ [field]: value });
    setSaving(false);
    if (result.success) fetchProfile();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Settings</h1>
      <p className="text-sm text-text-muted">Portal Preferences — how the Client Portal looks and reaches you.</p>

      {state.status === "loading" ? (
        <Skeleton className="h-64 w-full max-w-md" />
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your settings." onRetry={fetchProfile} />
      ) : (
        <div className="max-w-md space-y-4">
          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Theme</h2>
            <Select value={state.profile.portalPreferences.theme} onChange={(event) => handleThemeChange(event.target.value as "light" | "dark" | "system")} disabled={saving}>
              <option value="system">Match my device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Language</h2>
            <Select disabled title="More languages are coming soon.">
              <option>English</option>
            </Select>
            <p className="mt-1 text-xs text-text-muted">More languages aren&rsquo;t available yet.</p>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Timezone</h2>
            <div className="flex items-center gap-2">
              <Input value={timezoneDraft} onChange={(event) => setTimezoneDraft(event.target.value)} placeholder="e.g. America/New_York" className="flex-1" />
              <Button type="button" variant="secondary" onClick={handleTimezoneSave} disabled={saving}>
                Save
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Notification Settings</h2>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={state.profile.portalPreferences.email_notifications_enabled}
                  disabled={saving}
                  onChange={(event) => handleNotificationToggle("emailNotificationsEnabled", event.target.checked)}
                />
                Email notifications
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={state.profile.portalPreferences.sms_notifications_enabled}
                  disabled={saving}
                  onChange={(event) => handleNotificationToggle("smsNotificationsEnabled", event.target.checked)}
                />
                SMS notifications
              </label>
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Privacy</h2>
            <p className="text-sm text-text-muted">
              Your planning team can see your event, contract, invoice, proposal, and document details. Team members outside your planning team never see your information. You can review everything
              this portal shows about you across My Documents, My Contracts, and Account.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
