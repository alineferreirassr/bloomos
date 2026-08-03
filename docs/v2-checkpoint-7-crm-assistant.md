# v2.0 Checkpoint 7 — CRM Assistant (Relationship Intelligence Engine)

Checkpoint 6 delivered the AI Memory & Knowledge Layer, giving every Skill shared, structured operational memory. This checkpoint delivers Bloom AI's **first full business assistant** — not a chatbot, not a search interface, but an intelligent relationship manager that reads this Workspace's own Clients, Leads, Contracts, Payments, Events, Proposal history, and approved AI Memory to surface who needs attention, what's at risk, and what to prioritize next.

**Non-goals, explicitly**: no Finance Assistant, no Document Assistant, no Workflow Builder, no Automation Engine, no email/SMS/phone integration, no CRM automations, no predictive ML. See `docs/crm-assistant.md`'s "Future extensions" for what's prepared but deliberately not implemented.

## Architecture

`CRM Assistant UI → executeSkill() → CRM Assistant Skill → CRM Context Builder → Memory Manager → Knowledge Store → Context Orchestrator → AI Runtime → Structured Output`, exactly as specified. `crm-assistant` (Step 1) is registered as a Skill with **no special execution path** — its `execute` is the same one-line `runSkillCompletion` delegation Proposal Generator, Event Operations Brief, Daily Operations Brief, and Browse AI Memory already use, this time against a new composite context (`crmAssistantContext`, a new `AIContextSectionKey`) spanning six entity types plus the optional shared Memory Layer, rather than a single feature's own data.

## Skill integration

`registerCRMAssistantSkill.ts` proves the same "one Skill, zero special-casing" guarantee every prior checkpoint's own migration proved: `requiredPermissions: ["clients.view"]` (the primary permission, not every underlying data permission — the same precedent `daily-operations-brief` established with `events.view` alone), `requiredContext: ["crmAssistantContext"]`, `optionalContext: ["memory"]`, `commandPaletteVisible: true`. The pre-existing `crm-assistant` **placeholder** (`registerUpcomingSkills.ts`, Coming Soon since Checkpoint 4) was removed and replaced by this real registration — the same "Coming Soon → real Skill" transition Daily Brief made in Checkpoint 5. `getBloomAIOverview.ts` needed exactly one new registration call to make CRM Assistant appear as the platform's fifth Active Skill, with Skill Statistics/Prompt Versions/the Skill Picker all updating automatically — Step 8's own "Statistics should update automatically" is satisfied by the registry-driven Dashboard architecture Checkpoint 4 already built, requiring zero CRM-Assistant-specific Dashboard code.

## Memory usage

The Skill declares `optionalContext: ["memory"]` — requested, never required. `memoryContextBuilder.ts` (Checkpoint 6) already filters to `approvalStatus: "approved"` only, so **"never expose rejected memories" is satisfied at the source**. `registerCRMAssistantUseCase.ts`'s `composeContext` merges the optional section into `context.recentMemories`, used two ways: threaded into the model's own prompt (this Skill is explicitly meant to "understand... AI memory," unlike Daily Brief's deterministic-diff-only use or Proposal Generator's fully-separate-read-only use), and surfaced directly in the assembled report as "Recent AI Recommendations" (capped at 5, newest first). Two dedicated tests in `generateCRMAssistantBrief.test.ts` prove both halves of Step 6 hold under a real `AIMemoryManager` — an approved memory surfaces, a still-`"proposed"` one never does, and a `"rejected"` one never does.

## Context Builder

`crmAssistantContextBuilder.ts` wraps `fetchCrmAssistantMaterials` (eight independently-fetched categories via `Promise.allSettled`: Clients, Leads, Events, Contracts, Invoices, Proposal history, Daily Brief history, Activity) + `buildCrmAssistantContext` (pure classification: Priority/Inactive/At-Risk Clients, Active Leads, Upcoming/Past Events, Unsigned Contracts, Outstanding Invoices/Balance, a derived Communication Summary). **Never exposes sensitive internal notes**: `Client`'s own internal-only fields (allergies, accessibility needs, dietary restrictions, emergency contacts, do-not-call, surprise-event confidentiality) and Notes' own freeform `content` never reach `CrmAssistantContext` at all — `CrmAssistantClientSummary` is a closed, hand-picked projection structurally incapable of carrying them, the same "closed projection" guarantee `DailyBriefActivityEntry` already established for Audit Log entries. Clients/Leads are never sent to the model as raw rosters — only the already-classified, bounded subsets, keeping the prompt payload bounded regardless of how large a real Workspace's roster grows.

Extends the established Supabase-mode server-read workaround (`fetchDailyOperationsBriefContext.server.ts`'s own precedent, three data sources) to **five** data sources (adding Leads and Events to Finance/Contracts/Clients) — every one of `getClients`/`getLeads`/`getEvents`/`getContracts`/`getInvoices` is unsafe to call server-side in Supabase mode (wired to the browser-only Supabase client), so `fetchCrmAssistantContext.server.ts` gives each its own direct, server-side Supabase read.

## Validation

`crmAssistantModelOutputSchema` (Zod) mirrors every prior checkpoint's own bounded-length, closed-shape guarantee. `semanticValidation.ts` mirrors Daily Brief/Proposal Generator's **hard-reject** precedent, not Event Operations Brief's silent-drop one: every `clientRiskExplanations[].clientId` must already be on the deterministic at-risk list (the model may explain a risk, never decide who's at risk); every action's `targetId` is cross-checked against the real ids actually present in context for its `targetType` (`client`/`lead`/`event`/`contract`/`invoice`). This is architectural prevention, not detection — the model has no free-text field through which it could name a fabricated Client, Contract, Payment, Event, or Proposal status at all, satisfying Step 5's "reject responses that invent... never hallucinate business data" by construction. 9 dedicated tests cover every rejection path and every acceptance path.

## Browser verification

✓ Desktop verified. ✓ Mobile verified.

- Generated a fresh CRM report from `/crm-assistant`: real Executive Summary, Relationship Health counts (2 Clients, 2 Leads, 0 Priority, 0 Inactive, 1 At Risk), Client Risk correctly naming a real Client ("Supabase Client Verification") with its real risk reason ("Unsigned contract CT-2026-0002"), Contract Status and Payment Status showing the real unsigned Contract and the real $300.00 outstanding Invoice, Recommended Actions with working "Open Contract"/"Open Invoice" links, Confidence 100%, "Development mock" badge, and a generation timestamp.
- **A real copy bug was found and fixed via this checkpoint's own live browser verification, not by any automated test**: the mock provider's Executive Summary read "`{totalLeadCount} active Lead(s) tracked`," but `totalLeadCount` counts *every* Lead regardless of stage (including converted/lost/archived), not just active ones — inconsistent with "Revenue Opportunities" showing empty when `activeLeads` was genuinely empty. Fixed by using `context.activeLeads.length` instead, confirmed correct on regeneration (now reads "0 active Lead(s) tracked," consistent with the empty Revenue Opportunities section).
- The Bloom AI Dashboard (`/bloom-ai`) correctly reports 5 Active Skills / 2 Coming Soon (down from 4/3 pre-checkpoint), lists "CRM Assistant" with its real description, category "CRM," and prompt version `crm-assistant-v1`; "Ask Bloom" correctly lists it as a selectable, Active, "Mock" Skill.
- Mobile (375×812): `/crm-assistant` renders single-column with no horizontal overflow; every section (Relationship Health's stat grid, Client Risk, Upcoming Follow Ups, Revenue Opportunities, Contract Status, Payment Status, Recommended Actions) stacks correctly with working links.

## Tests

New test files (all passing): `contextBuilder.test.ts` (17 — Priority/Inactive/At-Risk Client classification, Active Leads, Event splitting, Contract/Invoice filtering, outstanding balance summation, Proposal history sorting, Communication Summary derivation, safe activity projection), `confidence.test.ts` (6), `actionTargets.test.ts` (2), `schema.test.ts` (9), `semanticValidation.test.ts` (9), `mockProvider.test.ts` (3), `assembleBrief.test.ts` (8), `generateCRMAssistantBrief.test.ts` (11 — permission gating, mock/live provider selection, malformed-output rejection, semantic-hallucination rejection, safe-error-on-throw, approved/proposed/rejected memory visibility, execution identity), `components/CRMAssistantView.test.tsx` (7 — idle state, generation, error/retry, Client Risk rendering with real links, Payment Status formatting, Skill runner registration/unregistration/invocation, Copy). Plus updates to `getBloomAIOverview.test.ts` (new active/coming-soon counts and permission fixture) and `src/config/navigation.test.ts` (the new CRM Assistant sidebar entry needed its own `clients.view` route mapping — caught by a pre-existing test asserting the CRM module fully collapses once every child is permission-hidden).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors, pre-existing warnings only (unrelated) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **384 test files, 4286 tests, all passing** |
| Coverage — `modules/ai/crmAssistant/` | 74.13% statements, 60.48% branches, 70.96% functions, 75.09% lines |
| Coverage — project-wide | 74.22% statements, 64.33% branches, 74.97% functions, 76.34% lines |
| Production build (`next build`) | Clean — `/crm-assistant` compiles as a dynamic route, no errors or warnings |

`fetchCrmAssistantContext.server.ts` shows 3.5% direct coverage — matching the established, precedented gap `fetchEventContext.server.ts`/`fetchDailyOperationsBriefContext.server.ts` already carry: server-only fetch files aren't unit-tested directly in this codebase; their behavior is exercised indirectly through the feature's own mocked integration test (`generateCRMAssistantBrief.test.ts` mocks this exact module), the same convention every prior checkpoint follows.

## Documentation

[docs/crm-assistant.md](docs/crm-assistant.md) (architecture, CRM Context Builder, sensitive-notes exclusion, Communication Summary, Prompt/Output split, Semantic Validation, Memory Integration, CRM Dashboard, Bloom AI Dashboard/Command Palette, Permissions, Observability, Future extensions) and this report. `docs/ai.md`'s status line updated to reflect Checkpoint 7 (pending — see Known limitations).

## Known limitations

- **The "Ask Bloom" picker's generic fallback route.** `BloomAISkillPicker.tsx`'s `runSkill` falls back to a hardcoded `router.push("/bloom-ai")` when no page-specific runner is registered for the picked Skill — pre-existing platform behavior, not introduced this checkpoint (Daily Brief has the identical limitation when picked from anywhere but `/dashboard`). Picking "CRM Assistant" from `/dashboard`'s own Ask Bloom lands on `/bloom-ai`, not directly on `/crm-assistant` — a real but pre-existing rough edge, out of scope for this checkpoint to fix (it's shared platform code, not CRM-Assistant-specific). CRM Assistant's own direct route (`/crm-assistant`, reachable from its own sidebar entry) is unaffected and is the primary, fully-verified discovery path.
- **Every Skill card on the Bloom AI Dashboard shows a generic "Open an Event" action**, including workspace-wide Skills like CRM Assistant, Daily Brief, and Browse AI Memory that have no per-Event applicability at all — a pre-existing cosmetic inconsistency from Checkpoints 4/5, not introduced or worsened by this checkpoint, previously flagged in Checkpoint 6's own report.
- **Proposal history, Daily Brief history, and Activity are always mock-only**, even in a real Supabase-backed Workspace — `getProposalsRepository()`, `getDailyBriefExecutionsRepository()`, and `getCoreAuditLogService()` are all hardcoded to their mock repositories regardless of data mode (pre-existing, documented in each of their own doc comments; confirmed during this checkpoint's own data-source audit, not a regression).
- **Communication Summary is a derived aggregate, not a real communication log** — BloomOS has no dedicated communication-log module yet (`ClientExtensionSummary.communicationHistory` is a hardcoded-empty stub). `totalLoggedTouchpoints`/`mostRecentTouchpointAt` are computed from Timeline Activity entries whose type is communication-adjacent, an honest approximation rather than a real log, documented as such in `docs/crm-assistant.md`.
- **No dedicated `crm.*` permission** — reuses `clients.view`, the same "primary permission" precedent every other workspace-wide Skill already follows; a future write path (e.g. approving a suggested follow-up) is where a dedicated permission would earn its keep.
- **No production AI provider is registered** — the CRM Assistant, like every other Skill, runs against its own deterministic mock, clearly labelled throughout the UI.

## Recommendation

**APPROVED.** The CRM Assistant executes entirely through `executeSkill()` with no special execution path, delivering all 12 spec'd output sections across a dedicated `/crm-assistant` page, hard semantic validation against six entity types, memory integration that both informs the model's narrative and surfaces informationally in the UI (never exposing a rejected or still-proposed memory), and full keyboard/ARIA/responsive accessibility. A real bug (a mislabeled lead count in the mock provider's own narrative) was caught and fixed via this checkpoint's own live browser verification before it could reach a real Workspace — the exact value that verification step exists to provide. Per the stop condition, Finance Assistant, Document Assistant, and Workflow Builder have not been started; no further feature work begins on any of them without further direction.
