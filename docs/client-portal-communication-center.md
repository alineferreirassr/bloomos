# Communication Center

`modules/clientPortal/getClientPortalCommunicationSummary.ts`, rendered at `/client-access/communication` by `ClientPortalCommunicationView.tsx`.

## Four sources, one new one

| Surface | Source | New this checkpoint? |
|---|---|---|
| Messages | `getClientPortalThread()` (Checkpoint 14) | No |
| Notifications | `getClientPortalNotifications()` (Checkpoint 14) | No |
| Announcements | `mockAnnouncementRepository` (Checkpoint 24) via `getClientPortalAnnouncementsAction` (Step 1) | No — new *accessor*, not a new store |
| Comments | Comments Platform (Checkpoint 24) via `getCoreCommentsService()` | The aggregation is new; the store isn't |

**Comments** is the one surface with real new plumbing: `ClientPortalContractDocumentSection.tsx`'s own "Review Requests" (Step 4, Checkpoint 34) already posts into the generic Comments Platform against `owner_type: "contract"`; this reads those same comments back across every one of the client's own published contracts — the only owner type a client can currently see comments on — and merges them into `recentComments`, sorted newest-first, capped at 10.

## Deliberately not surfaced

**Mentions** has no client-safe equivalent: `@Name` mentions (`core/communication/mentionEngine.ts`) only ever resolve against the internal Workspace member roster, which a `ClientAccount` is never part of. Rather than fake a mentions feed, it's omitted entirely. **Unified Communication Timeline** is not rebuilt here — the existing `/client-access/timeline` page (Step 8) is linked to from the Communication Center's own quick-links row, never duplicated.

## Named action

`getClientPortalCommunicationSummaryAction()` returns `{ unreadMessageCount, unreadNotificationCount, announcements[], recentComments[] }` in one round trip (`Promise.all` over the four sources above) — the same shape `getClientDashboardData()`'s `recentActivity` field also draws from for Portal Home.
