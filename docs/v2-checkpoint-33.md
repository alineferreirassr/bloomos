# v2.0 Checkpoint 33 — Proposal & Quote Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Checkpoint 32 (Client Journey) coordinated the existing commercial modules into one continuous journey. This checkpoint builds the platform that actually **prepares** one of those modules' own artifacts — the Proposal — for presentation: templates, a builder, pricing, packages, add-ons, versioning, comparison, health, readiness, analytics, and a client-facing experience, all layered additively on top of the existing `ProposalDraft` entity (Checkpoint 3) without ever duplicating it.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/proposalPlatform.ts` | `Proposal` (= `ProposalDraft`, reused)/`ProposalVersion`/`ProposalSnapshot`/`ProposalTemplate`/`ProposalPackage`/`ProposalAddon`/`ProposalSection`/`ProposalVariable`/`ProposalPricing`/`ProposalHealth`/`ProposalReadiness`/`ProposalAnalyticsSnapshot`/`ProposalComparisonResult`/`ProposalSummary` — see [`proposal-platform.md`](proposal-platform.md) |
| Mock stores | `lib/data/mock/{proposalTemplatesStore,proposalPackagesStore,proposalAddonsStore,proposalBuilderStore}.ts` | The 4 persisted entities this checkpoint owns |
| Builder + Versioning | `core/proposalPlatform/proposalBuilderEngine.ts` | [`proposal-builder.md`](proposal-builder.md), [`proposal-versioning.md`](proposal-versioning.md) |
| Pricing Engine | `core/proposalPlatform/pricingEngine.ts` | [`pricing-engine.md`](pricing-engine.md) |
| Package/Add-on libraries | `lib/data/mock/{proposalPackagesStore,proposalAddonsStore}.ts` | [`proposal-package-builder.md`](proposal-package-builder.md) |
| Comparison Engine | `core/proposalPlatform/proposalComparisonEngine.ts` | 8-category structural diff |
| Health / Readiness Engines | `core/proposalPlatform/{proposalHealthEngine,proposalReadinessEngine}.ts` | [`proposal-health.md`](proposal-health.md) |
| Analytics Engine | `core/proposalPlatform/proposalAnalyticsEngine.ts` | [`proposal-analytics.md`](proposal-analytics.md) |
| Knowledge Graph / Executive integration | `core/proposalPlatform/{proposalKnowledgeGraphEngine,proposalExecutiveIntegration}.ts` | Pure translation, no second graph or decision engine |
| Performance cache | `core/proposalPlatform/proposalCache.ts` | 30s TTL in front of the two O(N) reads |
| Module layer | `modules/proposalPlatform/proposalPlatformActions.ts` | Every server action, session-gated |
| Client Portal | `modules/clientPortal/getClientPortalProposal.ts` | [`proposal-client-portal.md`](proposal-client-portal.md) |
| Dashboard + Detail | `/proposals`, `/proposals/[id]` | [`proposal-dashboard.md`](proposal-dashboard.md), [`proposal-detail.md`](proposal-detail.md) |

## Reuse, honored exactly as the stop condition requires

- **The Proposal entity itself** — `ProposalDraft` (Checkpoint 3) is untouched as a type; this checkpoint only added a small, additive Timeline+Knowledge-Graph hook to `generateProposalDraft.ts` (recording `proposal_version_of`/`proposal_supersedes` along its own existing regeneration chain) and left `acceptProposalDraft.ts`/`rejectProposalDraft.ts` completely unmodified — they remain the sole, staff-only path that flips `ProposalDraft.status`.
- **CRM/Client/Event** — read straight from the existing `ProposalDraft.client_id`/`event_id`; `getClientById` resolves the real Client record for readiness/health checks, never a re-derived one.
- **Client Journey** — `ProposalHealth`'s `journey_readiness` category accepts an already-computed Journey health score as input rather than recalculating it; `proposal_related_journey` is disclosed reserved Knowledge Graph vocabulary (the Journey has no node identity of its own, per Checkpoint 32's own precedent).
- **Knowledge Graph** — 7 of 8 named relationship types are live edges (the most of any checkpoint since Dispatch), because unlike most prior checkpoints' aggregate records, a `ProposalDraft` is already a real, individually-addressable node.
- **Executive Decisions** — `proposalRecommendationsForExecutiveDecisions()` is one more `recommendationSources` entry, the exact `client_journey_engine` seam Checkpoint 32 established — 7 named recommendation types (Ready To Send, Needs Review, Missing Pricing, Stalled, Expiring, Archived, High Value Waiting).
- **Timeline** — reused directly; `proposal_created`/`accepted`/`declined` (Checkpoint 32) stay exactly as they were, and this checkpoint supplies the real Send/View triggers (`proposal_document_sent`/`proposal_document_viewed`) Checkpoint 32 explicitly deferred for lack of a real trigger at the time.
- **Comments/Notes/Search** — the existing `"proposal"` `EntityType` (Checkpoint 3) is reused directly; no new EntityType was needed since `ProposalDraft` is already a real persisted row.
- **No AI, no PDF, no e-signature, no real payment provider, no CRM/Timeline/Communication/Document duplicate anywhere.** The Pricing Engine is disclosed placeholder arithmetic for coupons/taxes; the Client Portal's Accept/Decline record non-binding client intent only (see [`proposal-client-portal.md`](proposal-client-portal.md)).

## The storage-split design decision, disclosed

Only 4 entities are genuinely new and persisted — `ProposalTemplate`, `ProposalPackage`, `ProposalAddon` (reusable libraries), and `ProposalBuilderState` (the mutable shell around append-only `ProposalVersion` history). Everything else — snapshots, pricing, health, readiness, analytics, comparisons, summaries — is computed fresh on every read by a pure engine, matching the "persist only what cannot be re-derived" discipline every checkpoint since Ops Center has followed.

## The `ProposalBuilderState` design decision, disclosed

Rather than mutating the existing `ProposalDraft` to carry builder/distribution state, this checkpoint introduced a new, additive, 1:1 companion shell keyed by `proposal_id`. This kept `ProposalDraft`'s own ~15 existing call sites and its full existing test suite completely untouched — confirmed by re-running `src/modules/ai/proposal/` (73 tests, unchanged, all passing) after the one small additive hook was added to `generateProposalDraft.ts`.

## Known limitations (disclosed, not hidden)

1. **No live authenticated browser verification.** Same as every prior checkpoint — `NEXT_PUBLIC_DATA_MODE=mock` still requires sign-in and this session has no demo credentials. Verified instead through 8 component tests, a successful `next build` of both new routes, and a live check that the `/proposals` route correctly redirects to the sign-in gate with zero server errors.
2. **Top Packages/Top Add-ons on the Dashboard show raw ids, not resolved names** — a small, disclosed display gap rather than an extra fetch that would blur the Dashboard's own single-read-per-load discipline.
3. **The Builder is a compact form, not a drag-and-drop canvas** — every field it submits flows through the same tested `CreateProposalVersionInput` pipeline a richer UI would use.
4. **`journey_readiness` (Proposal Health) currently receives `null`** — no live call site wires a real Client Journey health score into a Proposal evaluation yet; the category is honestly marked not-applicable rather than fabricated.

## Quality gates

- `tsc --noEmit -p .`: clean
- `eslint .`: clean (0 errors on every new/modified file, including the two `react-hooks` fixes made during authoring — an unused import and a set-state-in-effect pattern corrected before landing)
- `vitest run` (full repository): **849/850 test files, 7643/7644 tests passing.** The one failure (`src/lib/data/finance/mockRepository.reports.test.ts`, "nets a reversed entry to zero movement") is pre-existing and entirely unrelated to this checkpoint — confirmed by re-running it in isolation (fails identically) and confirming this checkpoint never touched `src/lib/data/finance/`. 119 new tests across 12 new test files for this checkpoint alone (8 core engine files, the module-layer integration suite, 2 dashboard/detail component files, and the Client Portal proposal suite), plus 3 tests added to 2 existing permission/navigation test files.
- `next build`: succeeds, including `/proposals` and `/proposals/[id]` as dynamic routes.

## Success criteria, answered

- **Creating proposals** — the existing `generateProposalDraft.ts` (Checkpoint 3), untouched.
- **Building reusable templates** — 8 system templates + custom, [`proposal-templates.md`](proposal-templates.md).
- **Managing pricing** — a deterministic Pricing Engine, [`pricing-engine.md`](pricing-engine.md).
- **Managing packages / add-ons** — 7 + 10 system entries + custom, [`proposal-package-builder.md`](proposal-package-builder.md).
- **Versioning proposals** — append-only, never overwritten, [`proposal-versioning.md`](proposal-versioning.md).
- **Comparing revisions** — an 8-category structural diff, reused by both the staff and Client Portal surfaces.
- **Measuring proposal health** — 7 categories mirroring Business Health's own pattern, [`proposal-health.md`](proposal-health.md).
- **Measuring readiness** — an 8-state waterfall culminating in a real Can Send / Cannot Send gate.
- **Extending the Client Portal** — 8 named client actions, Accept/Decline honestly non-binding, [`proposal-client-portal.md`](proposal-client-portal.md).
- **Feeding Executive Decisions** — 7 named recommendation types, translated through the existing seam, never a second decision engine.

No parallel Proposal, CRM, Timeline, Client Journey, Documents, Communication, Business Health, or Knowledge Graph system was created — and no Stripe/PayPal/Square/Apple Pay/Google Pay/ACH, e-signature, Google Calendar/Gmail/Outlook, real email/SMS, or PDF generation was ever connected.
