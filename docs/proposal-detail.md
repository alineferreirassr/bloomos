# Proposal Detail

`modules/proposalPlatform/components/ProposalDetailView.tsx`, routed at `/proposals/[id]`. See [`proposal-dashboard.md`](proposal-dashboard.md) for `/proposals`.

## What it shows

Reads `evaluateProposalAction` once and renders: Overview (title/status via `PageHeader`), a readiness-reason banner when not ready to send, 4 KPI cards (Overall Health/Current Version/Grand Total/Deposit Due), the in-app Builder panel ([`proposal-builder.md`](proposal-builder.md)), Sections (a read-only summary of the current version's content), Version History (with Restore + Compare), a Health Breakdown (all 7 [health categories](proposal-health.md)), and Internal Notes & Comments via the existing `CommentsPanel` (`ownerType: "proposal"` — the existing `EntityType`, never a new one).

Client, Packages, Add-ons, Variables, Documents, Communication, and Knowledge Graph — every one of the spec's own named surfaces (Step 19) — are covered without a separate tab each: **Client** links out to the real Client record; **Packages**/**Add-ons**/**Variables** are visible inside Sections and the Builder panel; **Documents**/**Communication** reuse the existing Comments panel and the workspace's own Unified Communication Timeline rather than a duplicated view; **Knowledge Graph** relationships ([`proposal-platform.md`](proposal-platform.md)) are written by the module layer on every version creation but have no dedicated visual explorer this checkpoint — the same disclosed gap every prior checkpoint's own Detail page has left for the general-purpose Knowledge Graph Explorer to eventually cover.

## Wired mutations

New Version (the Builder), Publish, Archive, Restore, Compare, Send — every one of the 6 real state-changing actions the module layer exposes. Send is gated: the button is disabled whenever `readiness.canSend` is `false`, and the server action itself re-checks readiness independently — the UI gate is a convenience, not the actual authority.

## Accessibility

Every list uses `role="list"`/`"listitem"`; every status/readiness/health value pairs a `Badge` with its own text label, never color alone; every action is a real `<button>`/`<a>` reachable by keyboard.

## Known gap

No live authenticated browser verification — the dev environment requires a real sign-in this session has no credentials for. Verified instead through component tests (`ProposalDetailView.test.tsx`) exercising the actual rendered UI against mocked module actions, plus a successful `next build`.
