/**
 * The canonical granular permission catalog — mirrors the seeded
 * `permissions` table exactly (`supabase/migrations/20260724101000_team_seed_data.sql`).
 * Business-module RLS itself is unchanged this phase (still Workspace-
 * isolation-only); this catalog exists for the team-management surface —
 * granting/checking permissions in mock mode, and rendering the role/
 * permission matrix in the UI — not for gating leads/clients/events/
 * contracts/finance/documents access yet.
 */
export const PERMISSIONS = [
  "workspace.view",
  "workspace.manage",
  "team.view",
  "team.invite",
  "team.manage_roles",
  "team.deactivate",
  "leads.view",
  "leads.create",
  "leads.update",
  "leads.archive",
  "clients.view",
  "clients.create",
  "clients.update",
  "clients.archive",
  "events.view",
  "events.create",
  "events.update",
  "events.archive",
  "contracts.view",
  "contracts.create",
  "contracts.update",
  "contracts.lifecycle",
  "finance.view",
  "finance.create",
  "finance.update",
  "finance.refund",
  "documents.view",
  "documents.create",
  "documents.update",
  "documents.archive",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
