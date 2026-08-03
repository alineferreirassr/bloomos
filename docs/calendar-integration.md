# Calendar Integration (Google Calendar) — v2 Checkpoint 43

`core/integrations/providers/googleCalendar/googleCalendarProvider.ts` — `GoogleCalendarProvider implements CalendarProvider`. A plain `fetch` client against Google Calendar's real documented REST API (`www.googleapis.com/calendar/v3`), not the `googleapis` npm SDK — this checkpoint has no real OAuth client configured to exercise an SDK-wrapped call against, so a heavy dependency would add weight without adding verifiability.

## Methods

- `ping()` — a lightweight authenticated GET, reports `{ok, latencyMs, error?}`.
- `createEvent({title, startsAt, endsAt, attendees})` → `{externalId}`.
- `updateEvent(externalId, partial)` → `{updated}`.
- `deleteEvent(externalId)` → `{deleted}`.
- `listEvents({from, to})` → the events in that window.

## Registration

`modules/integrations/providers/calendarProviders.ts`'s `google-calendar` entry was updated in place (version bumped, capabilities/`requiredPermission` set to `integrations.calendar`, description discloses the real adapter) — the provider id is unchanged, so any existing `IntegrationConnection` row for `google-calendar` keeps working. `modules/integrations/registerCheckpoint43ProviderFactories.ts` registers the real factory, constructing `GoogleCalendarProvider` from the connection's resolved OAuth access token.

## Honest disclosure

No Google OAuth client id/secret is configured in this environment (`docs/oauth-engine.md`'s Checkpoint 43 addendum). A workspace can install the `google-calendar` provider and walk the connection state machine by hand, but `completeProviderOAuthConnectionAction` will report `{configured: false}` rather than fabricate a real handshake — the adapter itself is real and correctly implemented, but unverified against a live Google account in this environment.

## Not built

Two-way sync, recurring-event expansion, and calendar-conflict detection are out of this checkpoint's scope — `listEvents`/`createEvent`/`updateEvent`/`deleteEvent` are the full surface.
