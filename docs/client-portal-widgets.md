# Portal Home Widgets

Step 13's own reusable dashboard widgets, both consumed by `ClientDashboardView.tsx` — the same one Portal Home the checkpoint's own "do not create a second dashboard" rule requires.

## `PortalSummaryStrip`

`modules/dashboard/luxury/components/PortalSummaryStrip.tsx` renders `PortalHomeSummaryData` (see [`unified-client-portal.md`](unified-client-portal.md)) as six `LuxuryMetricCard` tiles — the same metric-tile primitive the Owner and Team Dashboards already use for their own top-row metrics, not a new one-off tile:

| Tile | Field |
|---|---|
| Journey Stage | `journeyStageLabel` / `journeyNextStepLabel` |
| Unread Messages | `unreadMessageCount` |
| Open Proposals | `openProposalsCount` |
| Open Contracts | `openContractsCount` |
| Outstanding Balance | `outstandingBalanceLabel` |
| Latest Documents | `latestDocuments.length` |

Below the tiles, an Announcements card (Step 1's own use of `getClientPortalAnnouncementsAction`, Step 1) shows the same feed the Communication Center's own Announcements section renders — read once here, read again there, never duplicated data.

## `ClientRecentActivityCard`

`modules/dashboard/luxury/components/ClientRecentActivityCard.tsx` is a thin wrapper around the shared `ActivityFeedList` — the same "one list component, three named wrappers" pattern that primitive's own doc comment describes (`RecentMessagesCard` and `TeamActivityCard` on the Owner Dashboard being the other two). It renders `recentActivity` from `getClientDashboardData()`, itself sourced from the Communication Center's own comments aggregator (Step 7) rather than a new feed.
