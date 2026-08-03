# v2.0 Checkpoint 3 — AI Proposal Generator

The Bloom AI platform's first genuinely new feature, built entirely on Checkpoint 2's infrastructure — no feature-specific provider calls, no bypassed seams. See `docs/proposal-generator.md` for the full architecture writeup and `docs/ai.md` for the updated platform-level description.

## 1. Architecture decisions

- **No new provider seam.** `generateProposalDraft.ts` routes through the exact same five seams the Event Operations Brief already proved: `routeAIUseCase` (Prompt Registry) → `assembleAIContext` (Context Orchestrator) → `executeAIRequest` (AI Runtime) → `parseStructuredOutput`/`applySemanticValidation` (Structured Output). No `AIProvider.complete()` call exists anywhere in `modules/ai/proposal/`.
- **One new composite context key, `proposalContext`**, added to `AI_CONTEXT_SECTION_KEYS` rather than forcing this feature's Event/Venue/Timeline/Consultation-Notes/Contract-terms shape into an ill-fitting generic key — justified against Checkpoint 2's own precedent (the `event` key already holds a feature-specific shape, `EventOperationsBriefContext`).
- **Two more real Context Orchestrator builders** (`client`, `eventServiceAssignment`) — Checkpoint 2 reserved these keys with no builder; this checkpoint is the first to implement them, each living in `modules/ai/contextBuilders/` (never `core/ai/context/builders/`) since they depend on `lib/data`/`lib/supabase`, the same "core never imports from modules" boundary `eventContextBuilder.ts` already respects.
- **`humanApprovalPolicy: "always_required"`** on the registered use case — a deliberate divergence from the Event Operations Brief's `"not_required"`, since a Proposal is explicitly headed toward eventually being client-facing content, unlike an internal-only operational brief.
- **Version-chain design mirrors `Document`'s** — one row per version (`parent_proposal_id` + `version` + supersede-on-regenerate), not a separate join table, reusing a pattern already established elsewhere in BloomOS rather than inventing a new one.

## 2. Workflow

`ProposalGeneratorPanel` (embedded in Event Detail, directly below the Event Operations Brief section) → **Generate Draft** → `generateProposalDraft` Server Action creates a `status: "draft"` row → the panel renders every section plus a metadata strip (provider/latency/prompt version/draft version) → a human reviews it → **Accept Draft** or **Reject Draft** (each a separate Server Action, `events.update`-gated, stamping `reviewed_by`) → **Regenerate** re-runs the same flow, superseding the prior draft if it's still `"draft"` (an already-decided draft is left untouched). **Copy** exports the accepted structure as plain text for pasting elsewhere — no PDF, no email, no e-signature, all explicitly out of scope.

## 3. Context sources

Three Context Orchestrator sections requested together (`workspace`/`user` also included per every use case's baseline): `client` (safe fields only — internal-only Client fields like allergies/VIP flag/emergency contact are excluded at the builder level, not just the UI), `eventServiceAssignment` (the Event's actually-assigned, non-cancelled services), and `proposalContext` (Event/Venue/Timeline Summary/Consultation Notes/existing Contract payment terms/important constraints/missing information). `generateProposalDraft.ts` resolves `clientId` via one lightweight preliminary `fetchEventContextRecord` call before assembling context, since Orchestrator sections run in parallel and can't depend on each other.

## 4. Validation strategy

Three layers, in order: **(1) Zod schema** (`proposalModelOutputSchema`) — every required field non-optional, rejects malformed shapes outright. **(2) Semantic validation** (`validateProposalSemantics`) — service-reference integrity (every `eventServiceId` in the model's output must exist in the Event's actual assigned services) and pricing-schedule consistency (payment terms must sum to the real subtotal); either violation rejects the entire draft. **(3) Deterministic facts never touch the model** — pricing, service names/prices, dates, and AI Confidence are all computed in code from real records, never generated; the model only narrates and recommends on top of what's already true.

## 5. Human approval guarantees

- The AI has no code path to accept or reject its own draft — `generateProposalDraft.ts` only ever writes `status: "draft"`.
- `acceptProposalDraft`/`rejectProposalDraft` are separate Server Actions, reachable only from explicit UI buttons, each re-checking session + `events.update` permission and stamping the human actor's user id.
- A proposal can be accepted or rejected exactly once (`mockRepository.ts` refuses a non-`"draft"` proposal for either transition).
- Regenerating never overturns a human decision — only a still-`"draft"` parent is superseded; an accepted/rejected parent is left untouched.
- A `ProposalDraft`, at any status, never becomes authoritative on its own — it doesn't touch Contract, Event, or Finance state. Wiring an accepted Proposal into Contract creation is explicitly out of scope for this checkpoint.
- A model-suggested Memory is only ever `proposeMemory()`'d — `"proposed"`, never auto-approved, per Checkpoint 2's own AI Memory safety model.

## 6. Browser verification

**Bug found and fixed during this verification pass**: the app's live Workspace runs in `NEXT_PUBLIC_DATA_MODE=supabase`. The Proposals repository selector originally routed through `selectRepository()` like every migrated business module — but Proposals has no real `proposals` table yet (this phase is mock-only by design), so its Supabase repository is a throwing placeholder. Because `ProposalGeneratorPanel` calls `getLatestProposalForEvent` unconditionally on mount, every real Event Detail page load crashed (500) the instant this feature was wired in. Fixed in `src/lib/data/proposals/index.ts`: `getProposalsRepository()` now always returns the mock repository (matching the AI Memory Foundation's own unconditional-mock precedent from Checkpoint 2), with a doc comment explaining why this diverges from the standard `selectRepository()` pattern. Re-verified clean afterward.

**Desktop (1440×900, real Supabase-backed Workspace, Event "Supabase Events Verification (Edited)")**:
- Event Detail loaded with no console/server errors; "AI Proposal Generator" panel rendered "No proposal has been drafted yet for this Event."
- Clicked **Generate draft** → a full structured draft rendered: Draft v1, `Provider: mock`, `Latency: 1ms`, `Prompt: proposal-generator-v1`, `Confidence: 55%`, a "Development mock — not a real AI call" badge, Executive Summary, Event Overview, Services Included (correctly "No services are assigned to this Event yet." — this Event has none), Timeline Summary (correctly reflecting the Event's real schedule item), Pricing Summary (`US$ 0,00`, correctly following from zero services), Recommendations (correctly flagging the missing services/budget), Questions for Client, and a "View Missing Information (2)" disclosure.
- Clicked **Accept Draft** → status badge changed to "Accepted", Accept/Reject buttons disappeared, "Generate draft" reappeared (ready for a future v2) — exactly the documented behavior.
✓ Desktop verified

**Mobile (375×812, same Event, same session)**:
- Confirmed via rendered page content that the Accepted v1 draft (all the same sections, same data) renders correctly at mobile width — Executive Summary, Event Overview, Services Included, Timeline Summary, Pricing Summary, Recommendations, and Questions for Client all present and correctly laid out in the single-column mobile view.
✓ Mobile verified

## 7. Test evidence

357 test files, 4003 tests, all passing (up from 3905 pre-checkpoint) — `npx vitest run` clean. New test files: `schema.test.ts`, `semanticValidation.test.ts` (both hallucination-rejection rules + happy path), `assembleProposalDraft.test.ts`, `proposalContextBuilder.test.ts`, `promptBuilder.test.ts`, `clientContextBuilder.test.ts` (including the internal-fields-excluded assertion), `eventServiceAssignmentContextBuilder.test.ts`, `proposalDetailsContextBuilder.test.ts`, `mockRepository.test.ts` (proposals — version chain, supersede, accept/reject-once), `generateProposalDraft.test.ts` (full end-to-end integration, both hallucination-rejection paths), `reviewProposalDraft.test.ts` (accept/reject/get-latest + permission gating), `ProposalGeneratorPanel.test.tsx` (13 cases covering idle/loading/generate/error+retry/regenerate/accept/reject/no-actions-once-decided/copy/missing-info-toggle/all 3 Command Palette registrations). Three pre-existing suites regressed during integration (`EventDetail.test.tsx`, `generateEventOperationsBrief.test.ts`, `generateEventOperationsBrief.observability.test.ts` — a `server-only`/jsdom module-loading conflict from the new context builders) and were fixed via a dynamic-import pattern plus mocking the new Proposal Server Actions in `EventDetail.test.tsx`, matching its own existing precedent for `generateEventOperationsBrief`.

## 8. Coverage

`npm run test:coverage` passes (exit 0). Proposal-specific modules: `modules/ai/proposal` 93.98% statements / 96.29% functions; `lib/data/proposals` 85.48% statements; `core/ai` (platform, exercised further by this checkpoint) 98.73% statements. Full-project baseline: 73.85% statements / 63.91% branches / 74.71% functions / 76% lines.

## 9. Documentation

`docs/proposal-generator.md` (new, full feature architecture), `docs/v2-checkpoint-3-proposal-generator.md` (this report), `docs/ai.md` (status line, Context Orchestrator section list, new "Shipped: Proposal Generator" pointer, "Explicitly out of scope" list updated to remove the Proposal Generator and reflect the 3 newly-real context builders), `CHANGELOG.md` (new Checkpoint 3 entry).

## 10. Known limitations

- An accepted Proposal does not yet create/update a Contract, send anything to the client, or generate a PDF/e-signature request — explicitly out of scope for this checkpoint (see spec's non-goals).
- "Search Proposal" (Command Palette) navigates to the general `/events` list — no dedicated Proposal list/search surface exists yet.
- No real AI provider is registered; every draft is generated by a deterministic mock provider, clearly labelled in the UI.
- The AI Memory suggestion path has no review UI yet — a proposed memory is stored but nothing surfaces it for human approval.
- Proposals persistence is mock-only (no `proposals` table/migration) — a future migration phase would need to both create the real schema and update `getProposalsRepository()` to route through `selectRepository()` again.

## Recommendation

**APPROVED.**

All 12 spec steps are implemented and verified: the Proposal Feature routes exclusively through the Checkpoint 2 platform seams with no bypass; the Context Builder adds real `client`/`eventServiceAssignment`/`proposalContext` sections; the Prompt is registered with versioning, schema, semantic validator, provider requirements, approval policy, and token budget; the Output Schema is fully structured with no markdown parsing; Validation rejects both classes of hallucination the spec called out (invented services, invented pricing); the UI implements every listed action plus provider/latency/version display; human review is mandatory with no AI self-approval path; Memory suggestions are proposed-only; three Command Palette commands are registered; Observability logs safe metadata only; Accessibility follows the established ARIA/keyboard/live-region patterns; and Testing covers prompt, context builder, validation, hallucination rejection, schema, UI, approval flow, memory proposal, and Command Palette, with lint/typecheck/tests/coverage/build all passing. A genuine, checkpoint-blocking bug (the Supabase-mode crash) was found during the mandated live browser verification and fixed before certification, exactly the scenario this verification step exists to catch.

Per the stop condition: not beginning CRM Assistant, Finance Assistant, or Workflow Builder. Awaiting approval before any further checkpoint.
