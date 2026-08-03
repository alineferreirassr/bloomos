/**
 * Checkpoint 16, Step 3 — the Public API's own closed set of scopes,
 * deliberately a parallel vocabulary from the internal `Permission` union
 * (`core/enums/permission.ts`), not a 1:1 reuse of it. A `Permission`
 * governs what an internal Workspace member can do inside BloomOS itself;
 * a scope governs what a third-party application holding an API Key may
 * read through the Public API — two different trust boundaries that
 * happen to cover similar ground. Every endpoint built this checkpoint is
 * read-only (Steps 4-9's own "Read-only first"/"Read-only"/"Do not execute
 * workflows"), so only the `.read` scopes are ever actually required by a
 * route handler; the `.write` scopes exist in the registry (issuable to a
 * Key, listed in the Developer Console) because Step 3 explicitly names
 * `crm.write` as an example scope to create, but no endpoint checks for
 * one — see docs/public-api.md's own "Known limitations" for why write
 * access is deliberately inert this checkpoint (mirrors the Workflow
 * Builder's own "Manual Trigger registers but never executes" precedent).
 */
export const API_SCOPES = [
  "crm.read",
  "crm.write",
  "finance.read",
  "documents.read",
  "workflow.read",
  "analytics.read",
  "portal.read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "crm.read": "Read Clients, Events, Proposals, and cross-entity Search results.",
  "crm.write": "Reserved for a future write path — no endpoint uses this scope yet.",
  "finance.read": "Read Invoices, Receipts, Outstanding Balance, and Transactions.",
  "documents.read": "Read Templates, Documents, Versions, and Metadata.",
  "workflow.read": "Read Workflow lists, details, Simulation history, and Templates.",
  "analytics.read": "Read Metrics, Dashboard summaries, KPI Cards, and the Executive Summary.",
  "portal.read": "Read Portal Users, Timeline, Checklist, Messages metadata, and Notifications.",
};
