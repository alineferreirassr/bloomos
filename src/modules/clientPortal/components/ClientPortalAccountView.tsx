"use client";

import { useEffect, useState } from "react";
import { useClientAccountSession } from "@/components/providers/ClientAccountSessionProvider";
import { getClientPortalProfileAction, updateClientPortalPreferencesAction, type ClientPortalProfile } from "@/modules/clientPortal/getClientPortalProfile";
import { CONTACT_METHOD_LABELS, CONTACT_METHODS } from "@/core/enums/contactMethod";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { BloomAvatar } from "@/components/ui/BloomAvatar";

type ProfileState = { status: "loading" } | { status: "error" } | { status: "ready"; profile: ClientPortalProfile };

/**
 * Client Portal Account page — display-only account summary plus logout.
 *
 * Checkpoint 36, Step 11 — extended with the Profile Center's own
 * sections (Personal Information, Addresses, Preferences, Communication
 * Preferences), all read from `getClientPortalProfileAction`. "Emergency
 * Contacts" is deliberately not shown — see that action's own doc
 * comment for why. Deliberately still no billing settings, MFA
 * management, password reset administration, or account deletion.
 */
export function ClientPortalAccountView() {
  const session = useClientAccountSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>({ status: "loading" });
  const [savingPreferences, setSavingPreferences] = useState(false);

  const fetchProfile = () =>
    getClientPortalProfileAction().then((result) => {
      if (result.success) setProfileState({ status: "ready", profile: result.data });
      else setProfileState({ status: "error" });
    });

  useEffect(() => {
    fetchProfile();

  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await session.logout();
  };

  async function handleCommunicationPreferenceChange(value: string) {
    setSavingPreferences(true);
    const result = await updateClientPortalPreferencesAction({ communicationPreference: value === "" ? null : (value as (typeof CONTACT_METHODS)[number]) });
    setSavingPreferences(false);
    if (result.success) fetchProfile();
  }

  async function handleNotificationToggle(field: "emailNotificationsEnabled" | "smsNotificationsEnabled", value: boolean) {
    setSavingPreferences(true);
    const result = await updateClientPortalPreferencesAction({ [field]: value });
    setSavingPreferences(false);
    if (result.success) fetchProfile();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Account</h1>
      <p className="mt-1 text-sm text-text-muted">Your Client Portal profile.</p>

      <Card className="max-w-md">
        <div className="flex items-center gap-3 border-b border-border pb-3.5">
          <BloomAvatar name={session.clientName || "?"} />
          <div className="min-w-0">
            <div className="truncate font-serif text-base font-semibold text-text">{session.clientName || "—"}</div>
            <div className="truncate text-xs text-text-muted">{session.email}</div>
          </div>
        </div>

        <dl className="mt-3.5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Account status</dt>
            <dd className="capitalize text-text">{session.accountStatus}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Accepted</dt>
            <dd className="text-text">{session.acceptedAt ? new Date(session.acceptedAt).toLocaleDateString() : "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Last access</dt>
            <dd className="text-text">{session.lastAccessAt ? new Date(session.lastAccessAt).toLocaleDateString() : "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Workspace</dt>
            <dd className="text-text">{session.workspaceName}</dd>
          </div>
        </dl>

        <div className="mt-3.5">
          <Button variant="secondary" onClick={handleLogout} disabled={loggingOut} className="w-full justify-center">
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Card>

      {profileState.status === "loading" ? (
        <Skeleton className="h-64 w-full max-w-md" />
      ) : profileState.status === "error" ? null : (
        <div className="max-w-md space-y-4">
          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Personal Information</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <Field label="Name" value={`${profileState.profile.personal.firstName} ${profileState.profile.personal.lastName}`.trim()} />
              <Field label="Email" value={profileState.profile.personal.email} />
              <Field label="Phone" value={profileState.profile.personal.phone} />
              <Field label="Instagram" value={profileState.profile.personal.instagram} />
              <Field label="Partner" value={profileState.profile.personal.partnerName} />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Address</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <Field label="Address" value={profileState.profile.address.address} />
              <Field label="City / State" value={[profileState.profile.address.city, profileState.profile.address.state].filter(Boolean).join(", ") || null} />
              <Field label="ZIP" value={profileState.profile.address.zipCode} />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Preferences</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <Field label="Favorite colors" value={profileState.profile.preferences.favoriteColors} />
              <Field label="Favorite flowers" value={profileState.profile.preferences.favoriteFlowers} />
              <Field label="Favorite music" value={profileState.profile.preferences.favoriteMusic} />
              <Field label="Favorite food" value={profileState.profile.preferences.favoriteFood} />
              <Field label="Favorite drinks" value={profileState.profile.preferences.favoriteDrinks} />
              <Field label="Favorite restaurants" value={profileState.profile.preferences.favoriteRestaurants} />
              <Field label="Preferred style" value={profileState.profile.preferences.preferredStyle} />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Communication Preferences</h2>
            <label htmlFor="communication-preference" className="mb-1 block text-xs text-text-muted">
              Preferred contact method
            </label>
            <Select
              id="communication-preference"
              value={profileState.profile.communicationPreference ?? ""}
              onChange={(event) => handleCommunicationPreferenceChange(event.target.value)}
              disabled={savingPreferences}
            >
              <option value="">No preference set</option>
              {CONTACT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {CONTACT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Notification Preferences</h2>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={profileState.profile.portalPreferences.email_notifications_enabled}
                  disabled={savingPreferences}
                  onChange={(event) => handleNotificationToggle("emailNotificationsEnabled", event.target.checked)}
                />
                Email notifications
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={profileState.profile.portalPreferences.sms_notifications_enabled}
                  disabled={savingPreferences}
                  onChange={(event) => handleNotificationToggle("smsNotificationsEnabled", event.target.checked)}
                />
                SMS notifications
              </label>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="truncate text-right text-text">{value || "—"}</dd>
    </div>
  );
}
