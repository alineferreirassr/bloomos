# Context Engine (v2 Checkpoint 20)

The Context Engine is what lets Bloom AI never ask "which client/event/proposal do you mean?" — every page that has a natural current entity or module reports it, and the Copilot panel reads it back the instant it opens.

## Two halves

**Client-side (new this checkpoint)** — `modules/ai/copilot/CopilotPageContextProvider.tsx`. Tracks *where the user currently is* in the UI: current module, current entity (type/id/label), an optional selection, and optional active filters. This is what the panel reads to decide which Suggestion module to query and what to show in its context strip.

**Server-side (pre-existing, extended)** — `core/ai/context/orchestrator.ts` (`assembleAIContext`). Tracks *what facts about the business* a generative use case needs assembled (Workspace, User, Event, Client, proposal context, etc.) — unrelated to "which page is the user on." The Copilot's Writing Engine and Assistants read data directly via `@/lib/data` rather than the Orchestrator, since none of them call a real generative provider yet (see Known Limitations in the [certification report](v2-checkpoint-20-bloom-ai-copilot.md)) — the Orchestrator remains exactly as built in Checkpoints 2–9, untouched by this checkpoint.

## `CopilotPageContextValue`

```ts
// core/ai/copilot/types.ts
type EntityType = "client" | "lead" | "event" | "invoice" | "proposal" | "vendor" | "purchase" | "inventoryItem" | "document";

interface CopilotEntityRef {
  type: EntityType;
  id: string;
  label: string;
}

interface CopilotPageContextValue {
  module: string | null;       // e.g. "leads", "events", "inventory", "finance"
  entity: CopilotEntityRef | null;
  selection?: string[];        // reserved for multi-select list views
  filters?: Record<string, string>;
}
```

## How a page reports its context

Every List View reports just its module, with no entity:

```tsx
// LeadsListView.tsx / EventsListView.tsx / InvoicesListView.tsx / InventoryListView.tsx
useSetCopilotPageContext({ module: "leads", entity: null });
```

Every Detail View reports both, switching to `null` while data is still loading:

```tsx
// ClientDetailView.tsx / EventDetailView.tsx
useSetCopilotPageContext(
  state.status === "ready"
    ? { module: "clients", entity: { type: "client", id: client.id, label: client.first_name + " " + client.last_name } }
    : { module: "clients", entity: null },
);
```

`useSetCopilotPageContext` is an effect-based hook: it sets the context on mount/update and clears it on unmount, so navigating away from a Detail View always leaves the panel in a clean, page-appropriate state rather than showing a stale entity from the page the user just left.

## Reading context in the panel

`CopilotPanel.tsx` calls `useCopilotPageContext()` to read the current value, and:

- Shows the current entity (if any) in a small context strip at the top of the panel.
- Passes `pageContext?.module` into `getCopilotSuggestions(module, workspaceId)` — the Suggestion Engine only ever computes suggestions for the module the user is actually looking at.

## Fail-safe by design

`useCopilotPageContextApi()` — the low-level hook both `useCopilotPageContext`/`useSetCopilotPageContext` build on — returns a stable, module-level no-op fallback (`{ value: null, setValue: () => {} }`) when no `CopilotPageContextProvider` ancestor exists, rather than throwing. This means:

- A component that calls `useSetCopilotPageContext` is safe to render in any test, even one that doesn't wrap its tree in the provider — it's a documented, deliberate choice validated when adding Assistant Cards to existing pages broke zero pre-existing test files after this fix.
- Any future page can adopt context-reporting incrementally, in any order, without every other consumer needing to change first.

## Role-based Brief resolution

The Context Engine doesn't just track *page* location — the panel also reads the signed-in member's role via `useMemberSession()` and `resolveDashboardExperience(session.role)` (the same resolver Checkpoint 19's three Dashboards use) to decide which Brief to generate:

- `experience === "owner"` → `generateExecutiveBrief(workspaceId, firstName)`
- otherwise → `generateTeamBrief(workspaceId, memberId, firstName, fullName)`

This is how the Copilot panel delivers a role-appropriate Brief **from any page**, not just the Dashboard route — satisfying "accessible from anywhere" without touching the approved Dashboard's own layout.

## What the Context Engine deliberately does not do

- It does not persist across sessions or workspaces — it is pure React state, reset on reload (consistent with every other List/Detail View's own mock-data-resets-on-reload behavior in this codebase today).
- It does not infer context from URL parsing or route matching — every page explicitly reports its own context, so there is never a mismatch between what a page renders and what the Copilot believes is showing.
- It is not the same thing as `assembleAIContext`'s `AIContextSectionKey`s — those remain reserved for generative use cases (CRM/Finance Assistant, Proposal Generator) that need composed business-fact sections, not UI location.
