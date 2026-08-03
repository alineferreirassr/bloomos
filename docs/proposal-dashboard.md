# Proposal Dashboard

`modules/proposalPlatform/components/ProposalDashboardView.tsx`, routed at `/proposals`. See [`proposal-detail.md`](proposal-detail.md) for `/proposals/[id]`.

## What it shows

Reads `listProposalSummariesAction()` and `getProposalAnalyticsAction()` once and renders: 8 KPI cards (Drafts/Published/Sent/Viewed/Accepted/Declined/Archived/Acceptance Rate), 3 metric cards (Average Value + Conversion Rate, Average Discount/Deposit + Average Revisions, Average Time to Accept), 3 "Top" cards (Templates/Packages/Add-ons, each the top 5 by usage count), a Status filter (Draft/Revision/Published/Archived), the filtered proposal list, and a Recent Activity list sorted by `updatedAt` — the exact set Step 18 names.

Since a Proposal's id is a real persisted `ProposalDraft.id` (unlike the Client Journey's composite route id), no route-encoding scheme is needed — `/proposals/[id]` maps directly to it.

## Accessibility

Every list uses `role="list"`/`"listitem"`; every status/readiness value pairs a `Badge` with its own text label, never color alone.

## Known gap

No live authenticated browser verification — the dev environment requires a real sign-in this session has no credentials for. Verified instead through component tests (`ProposalDashboardView.test.tsx`) exercising the actual rendered UI against mocked module actions, plus a successful `next build` and confirmation the sign-in gate itself renders correctly with no server errors.
