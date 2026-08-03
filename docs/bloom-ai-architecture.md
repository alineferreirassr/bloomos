# Bloom AI Copilot Architecture (v2 Checkpoint 20)

Bloom AI stopped being a set of standalone Skill pages (CRM Assistant, Finance Assistant, Daily Brief, Proposal Generator) and became a **Copilot** — one persistent side panel, reachable from anywhere in BloomOS, that already knows what page you're on, greets you with a role-appropriate briefing, surfaces module-specific suggestions, and lets you run real BloomOS actions and writing tasks without leaving the panel. This checkpoint is intelligence and integration work only — the Luxury Design System, the approved Dashboards, routes, and permissions are all untouched (see "Non-goals" below).

## Design principle: reuse, never duplicate

Every new Copilot capability wraps something that already existed rather than reimplementing it:

- **Actions** (`core/ai/copilot/actionExecutor.ts`) call the existing Automation Action Registry (`core/automation/actionRegistry.ts`) — the Copilot never has its own mutation logic.
- **Suggestions** (`core/ai/copilot/suggestionEngine.ts`) formalize the `build*Insight()` pattern each List View already used (e.g. `LeadsListView`'s own AI insight card) into one shared, per-module registry.
- **Briefs** reuse existing repository reads (`getEvents`, `getInvoices`, `getLowStockInventoryItems`, `getDocuments`, `getLeads`, `getPayments`) and the existing `getCoreAuditLogService()`/`resolveDashboardExperience()` from Checkpoint 19 — no new data model.
- **Memory** (Prompt favorites, Activity History, Preferences) all reuse the existing `getMemoryManager()` API from Checkpoint 6, distinguished only by tag/category convention — no new persistence layer.
- **Writing** is a deterministic, honestly-labeled text transform — not a new AI provider integration (none is connected; see Known Limitations in the certification report).

## Module layout

```
core/ai/copilot/
  types.ts              — CopilotEntityRef, CopilotPageContextValue, CopilotSnapshot
  suggestionEngine.ts    — CopilotSuggestion type + per-module provider registry
  actionExecutor.ts      — executeCopilotAction() wrapping the Automation Action Registry
  writingEngine.ts       — deterministic text-transform engine (Writing Studio)

modules/ai/copilot/
  CopilotPageContextProvider.tsx   — Context Engine (client-side "where am I" state)
  CopilotProvider.tsx              — open/close state for the panel
  CopilotPanel.tsx                 — the side panel itself
  CopilotLauncher.tsx              — mobile FAB + Cmd/Ctrl+K shortcut
  registerCopilotCommands.ts       — Command Palette entries
  getCopilotSuggestions.ts         — client-callable suggestion fetch
  runCopilotAction.ts              — "use server" wrapper around actionExecutor
  briefs/                          — Executive / Team / Client Brief generators
  suggestions/                     — per-module suggestion providers (CRM/Finance/Inventory/Events)
  assistants/                      — Inventory / Event / Finance (Payment Forecast) assistants
  promptLibrary/                   — static categorized prompt templates
  writing/                         — Writing Studio modal + standalone page
  preferences/                     — Memory & Preferences page
  activity/                        — Activity History page
  copilotPreferences.ts            — Memory-backed preference + favorite-prompt store
  activityLog.ts                   — Memory-backed suggestion accept/dismiss log
```

## Data flow

```
Any page (Client Component)
   │  useSetCopilotPageContext({ module, entity })
   ▼
CopilotPageContextProvider  ──►  CopilotPanel (reads current context on open)
   │                                  │
   │                                  ├─ role-based Brief (Executive / Team)
   │                                  ├─ computeSuggestionsForModule(module) via suggestionEngine
   │                                  ├─ Command Palette search (getCommands/filterCommands)
   │                                  └─ Run action → runCopilotAction → executeCopilotAction
   │                                                 → getAutomationAction(actionId).execute()
   ▼
Client Portal pages (Client session, no CopilotPanel)
   └─ ClientBriefButton.tsx → generateClientBrief() (lighter, portal-only surface)
```

Every Brief/Suggestion/Assistant data-fetching function is a **plain client-callable async function**, not a `"use server"` Server Action. This mirrors how every existing List View already fetches its own data (`@/lib/data` repository functions resolve to the browser-bound Supabase client in `"supabase"` data mode; calling them from inside a genuine Server Action throws "Authentication is required," as `fetchDailyOperationsBriefContext.server.ts`'s own comments document). The one exception is `runCopilotAction.ts`, kept `"use server"` because it only calls Core services (`getCoreNotificationsService()`, already-`"use server"` functions like `generateProposalDraft`) — never the browser-bound `@/lib/data` facade directly.

## Where the panel opens from

- **Desktop**: a "Bloom AI" button in `TopBar.tsx` (every Classical page) — the Luxury `/dashboard` route has no `TopBar`, so the panel there is reached via Cmd/Ctrl+K or the mobile FAB fallback.
- **Keyboard**: `Cmd+K` / `Ctrl+K` from anywhere (`useKeyboardShortcut`, registered once in `CopilotLauncher.tsx`).
- **Mobile**: a floating action button (bottom-right), rendered full-screen when open.
- **Client Portal**: a separate, lighter `ClientBriefButton.tsx` next to "Sign out" in `ClientPortalShell.tsx` — Client Accounts have no `WorkspaceMemberRole`/session type compatible with the internal panel, so this is intentionally a distinct, smaller surface rather than reusing `CopilotPanel`.

## Performance

- The panel's own content (Brief, Suggestions) is only fetched when `open` is `true` — nothing loads for a user who never opens the Copilot.
- Both loading effects defer all `setState` calls into the async `.then()`/`.catch()` continuation (never synchronously at the top of the effect body), matching the `react-hooks/set-state-in-effect` rule and the established `BloomAISkillPicker.tsx` precedent: on repeat opens, the panel keeps showing its last-loaded content rather than flashing back to a skeleton.
- The three new Assistant Cards (`InventoryAssistantCard`, `EventAssistantCard`, `PaymentForecastCard`) are quiet, additive, and non-blocking: each guards its fetch with a `cancelled` flag and renders `null` on error rather than an error banner over an otherwise-working page — a failed supplementary card never breaks the host page.
- Command Palette search reuses the existing `getCommands()`/`filterCommands()` in-memory index — no new network round trip for typing in the panel's search box.

## Accessibility

- The panel is a real `dialog` (reusing `useDialogBehavior`, the same focus-trap/Escape/scroll-lock mechanics as `Drawer.tsx`/`Modal.tsx`) — keyboard-navigable, closes on Escape, traps focus while open.
- Tone glyphs on suggestion/brief lines (✓ / ! / •) carry `aria-hidden="true"` — the adjacent sentence, not the glyph, carries the meaning for screen readers.
- `prefers-reduced-motion` is respected via the existing sitewide rule from Checkpoint 19.2 — the panel's entrance animation (`animate-drawer-in`) is skipped under that preference like every other Drawer.

## Non-goals honored

No route was renamed or removed, no approved Dashboard layout was touched, no Design System token changed, and no existing page's permission model changed — the Copilot is additive at every integration point (`useSetCopilotPageContext` calls, new cards mounted after existing sections, a new button in `TopBar`).

## See also

- [Context Engine](context-engine.md)
- [Prompt Library](prompt-library.md)
- [Writing Engine](writing-engine.md)
- [Checkpoint 20 certification report](v2-checkpoint-20-bloom-ai-copilot.md)
