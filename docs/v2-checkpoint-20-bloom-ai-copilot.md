# v2.0 Checkpoint 20 — Bloom AI Copilot Platform

Transforms Bloom AI from a set of standalone Skill pages into a true operational Copilot: a persistent side panel, reachable from anywhere, that already knows what page you're on, greets you with a role-appropriate briefing, surfaces module-specific one-click suggestions, and lets you run real BloomOS actions and writing tasks without leaving the panel. Intelligence and integration work only — no visual redesign, no Design System changes, no Dashboard changes, no route or permission changes.

## Architecture

See [docs/bloom-ai-architecture.md](bloom-ai-architecture.md) for the full module layout and data flow. In summary: `core/ai/copilot/` holds the reusable engines (Context types, Suggestion Engine, Action Executor, Writing Engine); `modules/ai/copilot/` holds the panel UI, briefs, per-module suggestion providers, assistants, prompt library, writing surfaces, and Memory-backed preference/activity stores. Every new capability wraps an existing service rather than duplicating logic — Actions call the Automation Action Registry, Suggestions formalize the pre-existing per-List-View insight pattern, Briefs reuse existing repository reads, and Memory reuses the Checkpoint 6 Memory Manager under new tag conventions.

## Context Engine

See [docs/context-engine.md](context-engine.md). `CopilotPageContextProvider` tracks current module/entity client-side; every List View reports its module, every Detail View reports module + entity (cleared on unmount). The panel reads this to scope its Suggestions and show a context strip, and separately reads the signed-in member's role to choose Executive vs. Team Brief — all without touching the Dashboard routes themselves.

## Prompt Library

See [docs/prompt-library.md](prompt-library.md). 16 static, hand-written prompt templates across the 8 required categories (CRM, Finance, Events, Inventory, Documents, Marketing, Client Care, Operations), each openable directly in the Writing Studio. Favorites are saved through the existing Memory Manager (`favorite-prompt` tag), not a new store.

## Writing Studio

See [docs/writing-engine.md](writing-engine.md). A deterministic text-transform engine (`applyWritingAction`) covering 7 actions (Rewrite/Shorten/Luxury Tone/Professional Tone/Friendly Tone/Translate/Grammar) across 8 task types. Every transform is honestly labeled — `translate` explicitly returns `applied: false` with a note that a connected AI provider is required, rather than fabricating a translation. Embedded both as a standalone page (`/bloom-ai/writing-studio`) and inside the Proposal Assistant ("Improve with Bloom AI" on a draft proposal's Executive Summary).

## Executive Brief

`generateExecutiveBrief(workspaceId, firstName)` composes real revenue (this-month succeeded payments), upcoming events (7d), pending invoices, low-stock inventory, draft documents, new leads (7d), and team activity (audit log, 7d) into a greeting, a bulleted status list, and 3 rule-based recommendations — no LLM call, as the spec required. Delivered inside the Copilot panel (role-gated to owner/admin via `resolveDashboardExperience`), reachable from any page, not baked into the approved Owner Dashboard's own layout.

## Team Brief and Client Brief

`generateTeamBrief` scopes Events/checklist to the signed-in member's own assignments (matched on `Event.assigned_owner`/`ChecklistItem.assigned_name`, the same best-effort text-match convention `DailyBriefTeamAssignment` already used in Checkpoint 19) and surfaces a priority VIP client among them. `generateClientBrief` (no args — reads the current Client Portal session) surfaces days-until-event, pending payment/signature, checklist progress, and next step, delivered via a separate, lighter `ClientBriefButton.tsx` in the Client Portal shell (Client Accounts have no internal-panel-compatible session type).

## Assistants

- **CRM Assistant** — VIP/Risk indicators, relationship timeline, conversation summary were judged already satisfied by the existing per-client Timeline component and `communicationSummary` field from earlier checkpoints; no new code needed there.
- **Finance Assistant** — a genuinely new piece, `generatePaymentForecast()`, buckets outstanding invoice balances into 4 weekly buckets by due date, surfaced via `PaymentForecastCard` on the Finance Dashboard.
- **Inventory Assistant** — `generateInventoryAssistant()` computes real Low Stock/Suggested Purchases, upcoming-event count (14d), and a 0–100 Health Score; "Frequently Used Together" is an honest static disclaimer, since no purchase/event line-item co-occurrence data exists in this codebase yet.
- **Event Assistant** — `generateEventAssistant(eventId)` derives a real Packing List (unfulfilled service requirements *with* a matched inventory item) vs. Shopping List (unfulfilled requirements with none — genuinely need purchasing), Suggested Vendors (preferred vendors), and Suggested Team (workspace members other than the event's own assigned owner); Weather Reminder and Luxury Tips are static, honestly labeled.

All three new Assistant Cards (`InventoryAssistantCard`, `EventAssistantCard`, `PaymentForecastCard`) fetch independently and degrade quietly (render `null`) on error, so a failed supplementary card never breaks an otherwise-working page.

## Suggestion Engine

`core/ai/copilot/suggestionEngine.ts` is a Map-based, per-module provider registry (`registerSuggestionProvider`/`computeSuggestionsForModule`). Four modules are wired: CRM (Follow Up / Send Proposal / Decision Reminder / Schedule Meeting), Finance (Invoice Reminder / Payment Plan / Expense Review), Inventory (Restock / Reserve for Upcoming Events / Bundle reminder), Events (Assign Team / Checklist review / Timeline confirmation / real Calendar Conflict Detection via a `timeRangesOverlap()` helper). Where a suggestion has no clean single-entity Automation Action to wire (e.g. "send a proposal to N qualified leads" has no aggregate action), `actionId` is explicitly `null` and the card is informational-only rather than pretending to be actionable — the honest-scope-limiting pattern this whole session has followed. Where a real one-click action *does* exist (Events → Assign Team → `update-status`), `actionFacts` carries exactly the facts that Automation Action's own `execute()` needs.

## One-Click Actions

`executeCopilotAction(actionId, params)` looks up the action via the existing `getAutomationAction()` registry, re-checks `requiredPermissions` server-side, calls `.execute()`, and logs the outcome — the Copilot never has its own mutation logic, only a thin, permission-re-checked dispatch onto Checkpoint 9's Automation Engine.

## Command Palette

9 new commands registered (Create Proposal, Open Client, Search Invoice, Generate Summary, Create Reminder, Create Purchase, Reserve Inventory, Assign Team, Open Calendar), searchable from the panel's own search box, reusing the pre-existing `getCommands()`/`filterCommands()`/`runSearch()` index rather than a new search implementation.

## Memory

Prompt favorites, Activity History (suggestion accepted/dismissed), and 6 named Preferences (Preferred Proposal Style, Favorite Vendors, Preferred Flower Style, Writing Tone, Greeting Style, Favorite Hotel) all persist through the existing Memory Manager, `category: "workspace_knowledge"`, `visibility: "user"` — never a new store, and never anything sensitive (payment details, credentials, or personal data are out of scope by design, matching the spec's own "Do NOT store sensitive information").

## Performance

Panel content (Brief/Suggestions) fetches only when the panel is open. Both effects defer `setState` into the async continuation rather than synchronously at the top of the effect (`react-hooks/set-state-in-effect`), so repeat opens keep showing the last-loaded content instead of flashing a skeleton. Assistant Cards are independently guarded against unmount races (`cancelled` flag) and fetch failures. Command Palette search reuses the existing in-memory index — no new network round trip while typing.

## Accessibility

The panel is a real dialog (`useDialogBehavior` — focus trap, Escape-to-close, scroll lock, the same mechanics as `Drawer`/`Modal`). Tone glyphs on Brief/Suggestion lines carry `aria-hidden="true"`, since the adjacent sentence carries the meaning. `prefers-reduced-motion` is respected via the existing sitewide rule.

## Browser Verification

✓ Desktop verified (1280×800). ✓ Mobile verified (375×812) — a full, live pass against the real dev server (temporarily switched to mock data mode for local verification only, then reverted to `supabase`, matching this session's own established verification pattern).

- **Panel open triggers**: the "Bloom AI" button in `TopBar` (desktop), `Cmd/Ctrl+K` from any page, and the mobile floating action button all open the same panel correctly.
- **Executive Brief**: rendered real, workspace-derived figures (revenue collected this month, events in the next 7 days, outstanding invoice total, inventory health, draft document count, new leads, team activity count) plus a rule-based recommendation — confirmed on the Leads page (non-Dashboard route), proving "accessible from anywhere."
- **Context-aware Suggestions**: on `/leads`, the panel surfaced "Follow up with Sofia Marchetti" (an actual stale qualified lead from the seed data) alongside aggregate CRM suggestions — proving the Suggestion Engine reads real workspace data scoped to the current module.
- **Dismiss → Activity History round trip**: dismissing "Follow up with Sofia Marchetti" removed it optimistically from the panel; navigating to `/bloom-ai/activity` via the panel's own in-app link (client-side routing, preserving in-memory mock state) showed it logged as "Dismissed" with a real timestamp — confirming `logCopilotActivity` writes and `listCopilotActivity` reads round-trip correctly.
- **Writing Studio**: ran Luxury Tone against a plain draft email — output correctly prepended "With warmest regards," to the original text, and the page's own copy correctly disclosed "no AI provider connected yet."
- **Prompt Library**: all 8 categories and 16 templates rendered correctly at `/bloom-ai/prompts`, each with a working "Open in Writing Studio" link.
- **Memory & Preferences**: saved a Writing Tone preference ("Warm and personal, never overly formal") via `/bloom-ai/memory` — it appeared immediately in the saved list, confirming the Memory Manager write path.
- **Command Palette search**: typing "invoice" into the panel's search box surfaced the registered "Search Invoice" command, confirming the Command Palette expansion is wired into the panel's own search.
- **Mobile**: the floating action button opens the panel as a correctly-styled full-screen overlay with the same Brief/Suggestions/footer-links content, no layout breakage.
- No console errors observed on any of the above surfaces at either viewport.

## Quality Gates

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | Clean |
| ESLint (`eslint .`) | 0 errors, 16 warnings (pre-existing baseline, unchanged from prior checkpoints) |
| Test suite (`vitest run`) | **524 test files, 5270 tests, all passing** — including `writingEngine.test.ts` (9 new tests) and updated mocks in `FinanceDashboardView.test.tsx`, `InventoryListView.test.tsx`, `EventDetail.test.tsx` for the newly-mounted Assistant Cards |
| Production build (`next build`) | Clean — every `/bloom-ai/*` route (`/bloom-ai`, `/bloom-ai/prompts`, `/bloom-ai/memory`, `/bloom-ai/activity`, `/bloom-ai/writing-studio`) compiles |

A transient run of the full suite in a resource-constrained background process produced 10 worker-pool startup timeouts (unrelated files: `Toast.test.tsx`, `InventorySection.test.tsx`, `routeAccess.test.ts`, etc. — none touched by this checkpoint); an immediate clean rerun produced 524/524 files and 5270/5270 tests passing with zero errors, confirming the timeouts were environmental, not a regression.

## Documentation

[docs/bloom-ai-architecture.md](bloom-ai-architecture.md), [docs/context-engine.md](context-engine.md), [docs/prompt-library.md](prompt-library.md), [docs/writing-engine.md](writing-engine.md).

## Known Limitations

- **No generative AI provider is connected**, per this checkpoint's own stop condition. The Executive/Team/Client Briefs, all Suggestion Engine providers, and the Writing Engine are all deterministic computations/templates over real workspace data — honestly labeled everywhere they might otherwise be mistaken for model output (Writing Studio's own page copy, `translate`'s `applied: false`).
- **All new Copilot data-fetching functions are plain client-callable functions, not Server Actions** — a deliberate scope/risk tradeoff (see Architecture) to sidestep the Supabase browser-client binding constraint that would otherwise require bespoke dual-mode fetchers for every new generator, matching how every existing List View already fetches its own data. The one exception, `runCopilotAction.ts`, stays `"use server"` since it only calls Core services, never the browser-bound `@/lib/data` facade.
- **Several Suggestion Engine entries are informational-only (`actionId: null`)** — CRM's "Send a proposal to N qualified leads," "Decision Reminder," Finance's Invoice Reminder/Payment Plan/Expense Review, Inventory's Restock/Reserve/Bundle — because no clean single-entity Automation Action exists to wire an aggregate suggestion to, or (for CRM) no lead-facing email/SMS action exists in this codebase at all. Only Events' "Assign Team" suggestion is genuinely one-click today (`update-status`).
- **"Frequently Used Together" (Inventory Assistant) is a static disclaimer**, not real data — no purchase/event line-item co-occurrence dataset exists yet.
- **"Upcoming meeting" (Client Brief) narrates the Event itself** — this domain model has no separate meeting entity.
- **Weather Reminder (Event Assistant) is a static, honest message** — no weather API integration exists or was added.
- **Mock data resets on full page navigation**, same as every other List/Detail View in this codebase today (documented on the Leads page itself) — the Copilot's Activity History and Preferences correctly persist within a session (confirmed via in-app client-side navigation) but, like all mock-mode state, reset on a hard reload; this is pre-existing app-wide behavior, not something this checkpoint introduced or could fix within its own scope.

## Recommendation

**APPROVED.** Bloom AI now behaves like a persistent Executive Assistant rather than a chat window bolted onto a dashboard: it opens from anywhere, already knows the current page's module and entity, greets the user with a role-appropriate real-data briefing, surfaces module-scoped suggestions with a working accept/dismiss/activity-log loop, and lets a member run real one-click Automation Actions and deterministic writing transforms without leaving the panel — all verified live in the browser at desktop and mobile. Every new capability reuses an existing BloomOS service rather than duplicating logic, and every place a real generative capability is out of scope (translation, true AI rewriting) is honestly labeled rather than faked. No route, permission, Dashboard, or Design System change was made. Per the stop condition, no external AI provider, payment integration, Stripe, Google Calendar, or Twilio integration was implemented — the platform architecture and native Copilot experience are complete and ready for a future checkpoint to connect a real provider behind the same seams.
