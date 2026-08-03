# Profile Center & Portal Settings

`modules/clientPortal/getClientPortalProfile.ts`, rendered at `/client-access/account` (`ClientPortalAccountView.tsx`, Step 11) and `/client-access/settings` (`ClientPortalSettingsView.tsx`, Step 12). One read model, `getClientPortalProfileAction()`, backs both pages.

## Profile Center (Step 11): reading the client's own record back to them

Personal Information, Address, and Preferences are read directly from the real `Client` CRM record (`getClientById`) — every field returned is one the client already knows about themselves, so surfacing it introduces no new exposure.

**Emergency Contacts is deliberately not shown.** `types/client.ts`'s own field comment marks `emergency_contact_name`/`emergency_contact_phone` — along with `allergies`, `accessibility_needs`, `dietary_restrictions`, `do_not_call`, `surprise_event_confidentiality`, and `is_vip` — "internal-only; never expose to a future Client Portal," a boundary drawn by an earlier checkpoint. This checkpoint respects that line rather than reversing it, which leaves a disclosed gap against the spec's own "Profile Center: Emergency Contacts" wording.

## The one genuinely new store: `client_portal_preferences`

Communication Preferences (a portal-side override of the CRM's own `preferred_contact_method`) and Notification/Theme/Timezone settings live in a small, new, `ClientAccount`-keyed mock store (`lib/data/mock/clientPortalPreferencesStore.ts`) — never the internal, member-keyed `notificationPreferencesStore.ts`, and never a write back to the real `Client` CRM record, which stays staff-owned. Both Profile Center and Portal Settings read and write the same store rather than each keeping its own copy.

## Portal Settings (Step 12)

| Section | Behavior |
|---|---|
| Theme | `system` / `light` / `dark`, persisted immediately on change |
| Language | Disabled placeholder — "English" only, no i18n exists yet |
| Timezone | Free-text IANA identifier (e.g. `America/New_York`), saved on demand |
| Notification Settings | Email/SMS toggles, the same fields Profile Center's own Notification Preferences section shows |
| Privacy | Informational only — describes what data the portal reads and who can see it; not a working export/deletion tool (no such backend exists this checkpoint) |

## Named actions

| Action | Purpose |
|---|---|
| `getClientPortalProfileAction()` | Personal/Address/Preferences (from `Client`) + `communicationPreference` + `portalPreferences` (from the new store) |
| `updateClientPortalPreferencesAction(input)` | Writes only to `client_portal_preferences` — theme, timezone, notification toggles, communication preference override |
