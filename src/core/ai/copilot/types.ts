import type { EntityType } from "@/core/enums/entityType";

/**
 * Checkpoint 20, Step 3 — the Context Engine's own client-side half. The
 * server-side Context Orchestrator (`core/ai/context/`) already assembles
 * deep, per-Skill data context from a `refs` bag; this type is the much
 * lighter "where is the user right now" signal a page declares so the
 * Copilot Panel never has to ask for information already on screen. A page
 * that never calls `useCopilotPageContext` simply leaves the Copilot with
 * `entity: null` — the panel still works, it just can't reference "this
 * Client" or "this Event" by name.
 */
export interface CopilotEntityRef {
  type: EntityType;
  id: string;
  /** Display name only (e.g. a Client's full name, an Event's title) — never a raw record dump. */
  label: string;
}

export interface CopilotPageContextValue {
  /** A short module key matching this app's own route/module vocabulary — "leads", "events", "finance", etc. `null` on pages with no clear module (Settings, Bloom AI Dashboard itself). */
  module: string | null;
  entity: CopilotEntityRef | null;
  /** IDs of whatever the user has currently selected on the page (e.g. checked table rows) — bounded, never a raw row dump. */
  selection?: string[];
  /** The page's own active filter values, already in display form (e.g. `{status: "Qualified"}`) — never a raw query object. */
  filters?: Record<string, string>;
}

/**
 * The full snapshot the Copilot Panel renders in its "Context" strip and
 * passes to the Suggestion Engine / Writing Engine — `CopilotPageContextValue`
 * plus the session facts every Skill in this codebase already receives
 * (`workspaceId`/`userId`/`role`/`permissions`), so nothing here invents a
 * second source of truth for "who is this" beyond what `MemberSessionProvider`
 * already holds.
 */
export interface CopilotSnapshot {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  role: string;
  permissions: string[];
  date: string;
  page: CopilotPageContextValue;
}
