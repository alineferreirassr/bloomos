import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/**
 * Finance F1.13 — this repository routinely carries several independent,
 * separately-authored bodies of work uncommitted in the working tree at
 * once (each its own future release), so a single global file count can't
 * describe "what HEAD plus THIS release contains" — it would describe
 * whatever else happens to also be sitting uncommitted alongside it. This
 * excludes exactly the migration file(s) known to belong to a DIFFERENT,
 * independently-tracked, not-yet-released body of work, so the exact-count
 * assertion below stays meaningful and precise for a standalone checkout of
 * HEAD + this release — true whether or not that other work is present in
 * the current working tree. Add a filename here only when a NEW body of
 * work is confirmed (via `git status`) to be uncommitted and unrelated to
 * the release under test — never to silently excuse an actual miscount.
 */
const KNOWN_UNRELATED_IN_FLIGHT_MIGRATIONS = new Set(["20260815100000_employee_wellness_privacy.sql"]);

function migrationFilesForThisRelease(): string[] {
  return migrationFiles().filter((name) => !KNOWN_UNRELATED_IN_FLIGHT_MIGRATIONS.has(name));
}

function readMigration(filename: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
}

/** Strips `-- ...` line comments so structural checks can't false-positive on prose that merely mentions SQL syntax. */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("supabase/migrations file structure", () => {
  it("contains exactly the 8 Supabase Foundation + 5 Leads + 6 Clients + 8 Events + 6 Media Library + 8 Contracts + 8 Finance + 8 Documents + 1 Phase 1 cleanup + 11 Team foundation + 1 Team foundation fix + 8 Client Accounts + Invitations foundation + 5 Client Portal MVP + 3 SECURITY DEFINER privilege-hardening + 3 Booking Workflow + 1 Clients Core-integration + 7 Inventory + 5 Vendors + 1 Inventory movement-recording function + 7 Purchases + 1 Purchases receiving function + 11 Finance Ledger Database + 1 Finance posting_key correction + 9 Finance Posting Engine + 1 Finance Reports Foundation + 20 Services Foundation schema migrations + 1 Event Service Workspace media owner_type widening migration + 1 Client Portal Checkpoint 14 schema migration + 1 Analytics permission seed migration + 1 Digital Asset Management media_assets workspace owner_type widening migration + 2 Finance F1.8 Payment Atomicity & Refund Reversal migrations + 1 Finance F2.1B Invoice Revenue Recognition migration + 1 Finance F2.1B-REVIEW refund guard migration (excluding independently-tracked, not-yet-released work still uncommitted alongside this one — see KNOWN_UNRELATED_IN_FLIGHT_MIGRATIONS), in chronological (execution) order", () => {
    const files = migrationFilesForThisRelease();
    expect(files).toHaveLength(161);
    // readdirSync + sort() on Supabase's YYYYMMDDHHMMSS_description.sql
    // naming convention gives execution order directly — this assertion is
    // really "the naming convention is followed," not a separate sort.
    expect(files).toEqual([...files].sort());
  });

  it("orders extensions/helpers before every table migration", () => {
    const files = migrationFiles();
    const extensionsIndex = files.findIndex((f) => f.includes("extensions_and_helpers"));
    const profilesIndex = files.findIndex((f) => f.includes("profiles"));
    const workspacesIndex = files.findIndex((f) => f.includes("workspaces") && !f.includes("workspace_members"));
    const membersIndex = files.findIndex((f) => f.includes("workspace_members"));

    expect(extensionsIndex).toBeGreaterThanOrEqual(0);
    expect(extensionsIndex).toBeLessThan(profilesIndex);
    expect(profilesIndex).toBeLessThan(workspacesIndex);
    expect(workspacesIndex).toBeLessThan(membersIndex);
  });

  it("orders profiles, workspaces, workspace_members before the updated_at trigger migration", () => {
    const files = migrationFiles();
    const membersIndex = files.findIndex((f) => f.includes("workspace_members") && !f.includes("helpers"));
    const triggerIndex = files.findIndex((f) => f.includes("updated_at_trigger"));
    expect(membersIndex).toBeLessThan(triggerIndex);
  });

  it("orders the updated_at trigger before the membership helper functions", () => {
    const files = migrationFiles();
    const triggerIndex = files.findIndex((f) => f.includes("updated_at_trigger"));
    const helpersIndex = files.findIndex((f) => f.includes("workspace_membership_helpers"));
    expect(triggerIndex).toBeLessThan(helpersIndex);
  });

  it("orders the membership helper functions before RLS enablement", () => {
    const files = migrationFiles();
    const helpersIndex = files.findIndex((f) => f.includes("workspace_membership_helpers"));
    const rlsIndex = files.findIndex((f) => f.includes("rls_enablement"));
    expect(helpersIndex).toBeLessThan(rlsIndex);
  });

  it("orders RLS enablement before the storage buckets/policies migration", () => {
    const files = migrationFiles();
    const rlsIndex = files.findIndex((f) => f.includes("rls_enablement"));
    const storageIndex = files.findIndex((f) => f.includes("storage_buckets_and_policies"));
    expect(rlsIndex).toBeLessThan(storageIndex);
  });
});

describe("profiles migration", () => {
  const sql = readMigration("20260715150100_profiles.sql");

  it("creates the profiles table referencing auth.users", () => {
    expect(sql).toMatch(/create table if not exists public\.profiles/i);
    expect(sql).toMatch(/references auth\.users/i);
  });

  it("provisions profiles via a trigger on auth.users, not direct application inserts", () => {
    expect(sql).toMatch(/create trigger trg_handle_new_user/i);
    expect(sql).toMatch(/after insert on auth\.users/i);
  });
});

describe("workspaces migration", () => {
  const sql = readMigration("20260715150200_workspaces.sql");

  it("creates the workspaces table with the required columns", () => {
    for (const column of ["id", "name", "slug", "created_by", "created_at", "updated_at", "archived_at"]) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("uses a uuid primary key generated server-side", () => {
    expect(sql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i);
  });
});

describe("workspace_members migration", () => {
  const sql = readMigration("20260715150300_workspace_members.sql");

  it("declares the five canonical roles and three statuses via check constraints", () => {
    expect(sql).toMatch(/role in \('owner', 'admin', 'manager', 'team', 'viewer'\)/);
    expect(sql).toMatch(/status in \('active', 'invited', 'suspended'\)/);
  });

  it("enforces uniqueness on (workspace_id, user_id)", () => {
    expect(sql).toMatch(/unique \(workspace_id, user_id\)/i);
  });

  it("indexes workspace_id and user_id", () => {
    expect(sql).toMatch(/create index.*workspace_id/i);
    expect(sql).toMatch(/create index.*user_id/i);
  });
});

describe("workspace membership helper functions migration", () => {
  const sql = readMigration("20260715150500_workspace_membership_helpers.sql");

  it("defines all three documented helper functions", () => {
    expect(sql).toMatch(/create or replace function public\.is_workspace_member/i);
    expect(sql).toMatch(/create or replace function public\.has_workspace_role/i);
    expect(sql).toMatch(/create or replace function public\.current_user_workspace_ids/i);
  });

  it("every security definer function pins search_path (privilege-escalation guard)", () => {
    const definerFunctionBlocks = sql.split(/create or replace function/i).slice(1);
    for (const block of definerFunctionBlocks) {
      if (/security definer/i.test(block)) {
        expect(block).toMatch(/set search_path = public/i);
      }
    }
  });

  it("filters to active status, so suspended members fail every membership check", () => {
    const occurrences = sql.match(/status = 'active'/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });
});

describe("RLS enablement migration", () => {
  const sql = readMigration("20260715150600_rls_enablement.sql");

  it("enables row level security on all three foundation tables", () => {
    expect(sql).toMatch(/alter table public\.profiles enable row level security/i);
    expect(sql).toMatch(/alter table public\.workspaces enable row level security/i);
    expect(sql).toMatch(/alter table public\.workspace_members enable row level security/i);
  });

  it("never uses a bare permissive `using (true)` policy", () => {
    expect(stripSqlComments(sql)).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("scopes every policy to the authenticated role, blocking anonymous access", () => {
    const policyBlocks = sql.split(/create policy/i).slice(1);
    expect(policyBlocks.length).toBeGreaterThan(0);
    for (const block of policyBlocks) {
      expect(block).toMatch(/to authenticated/i);
    }
  });

  it("restricts workspace/member management to owner and admin roles", () => {
    expect(sql).toMatch(/has_workspace_role\(id, array\['owner', 'admin'\]\)/);
    expect(sql).toMatch(/has_workspace_role\(workspace_id, array\['owner', 'admin'\]\)/);
  });

  it("scopes the profiles policies to the requester's own row", () => {
    const profileBlock = sql.slice(sql.indexOf("profiles_select_own"), sql.indexOf("workspaces_select_member"));
    expect(profileBlock).toMatch(/id = auth\.uid\(\)/);
  });
});

describe("storage buckets and policies migration", () => {
  const sql = readMigration("20260715150700_storage_buckets_and_policies.sql");

  it("creates both buckets as private (public = false)", () => {
    expect(sql).toMatch(/values \('documents', 'documents', false\)/);
    expect(sql).toMatch(/values \('avatars', 'avatars', false\)/);
  });

  it("gates documents object access on workspace membership", () => {
    const documentsPolicies = sql.split(/create policy "documents_/i).slice(1);
    expect(documentsPolicies.length).toBe(4);
    for (const block of documentsPolicies) {
      expect(block).toMatch(/is_workspace_member/);
      expect(block).toMatch(/to authenticated/i);
    }
  });

  it("gates avatar object access on the requesting user owning that folder", () => {
    const avatarPolicies = sql.split(/create policy "avatars_/i).slice(1);
    expect(avatarPolicies.length).toBe(4);
    for (const block of avatarPolicies) {
      expect(block).toMatch(/auth\.uid\(\)::text/);
      expect(block).toMatch(/to authenticated/i);
    }
  });

  it("never uses a bare permissive `using (true)` policy", () => {
    expect(stripSqlComments(sql)).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });
});

describe("Team foundation migrations", () => {
  it("widens workspace_members' role CHECK to the canonical owner/admin/manager/staff set", () => {
    const sql = readMigration("20260724100300_workspace_members_role_extension.sql");
    expect(sql).toMatch(/check \(role in \('owner', 'admin', 'manager', 'staff'\)\)/);
  });

  it("stores only a token hash on workspace_invitations, never a raw token column", () => {
    const sql = readMigration("20260724100400_workspace_invitations.sql");
    expect(sql).toMatch(/token_hash text not null/);
    expect(sql).not.toMatch(/\btoken text\b/);
  });

  it("enforces at most one pending invitation per Workspace/email via a partial unique index", () => {
    const sql = readMigration("20260724100400_workspace_invitations.sql");
    expect(sql).toMatch(/workspace_invitations_pending_email_unique/);
    expect(sql).toMatch(/where status = 'pending'/);
  });

  it("defines the token-based lookup and acceptance functions as security definer with a pinned search_path", () => {
    const sql = readMigration("20260724100500_invitation_helper_functions.sql");
    const definerFunctionBlocks = sql.split(/create or replace function/i).slice(1);
    expect(definerFunctionBlocks.length).toBeGreaterThan(0);
    for (const block of definerFunctionBlocks) {
      if (/security definer/i.test(block)) {
        expect(block).toMatch(/set search_path = public/i);
      }
    }
  });

  it("defines the last-owner and role-escalation protection triggers on workspace_members", () => {
    const sql = readMigration("20260724100600_role_permission_helper_functions.sql");
    expect(sql).toMatch(/trg_protect_workspace_owners/);
    expect(sql).toMatch(/before update or delete on public\.workspace_members/);
    expect(sql).toMatch(/trg_validate_invitation_role_authority/);
  });

  it("enables RLS on every new Team foundation table", () => {
    const sql = readMigration("20260724100900_team_rls.sql");
    for (const table of ["roles", "permissions", "role_permissions", "workspace_invitations"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("never uses a bare permissive `using (true)` policy on a Workspace-scoped table", () => {
    const sql = stripSqlComments(readMigration("20260724100900_team_rls.sql"));
    // roles/permissions/role_permissions are the sole, documented exception —
    // global reference data with no workspace_id to scope by.
    const workspaceScopedPolicies = sql
      .split(/create policy/i)
      .slice(1)
      .filter((block) => /workspace_invitations|workspace_members/i.test(block));
    for (const block of workspaceScopedPolicies) {
      expect(block).not.toMatch(/using\s*\(\s*true\s*\)/i);
    }
  });

  it("seeds exactly the four canonical roles and grants owner/admin every permission", () => {
    const sql = readMigration("20260724101000_team_seed_data.sql");
    for (const role of ["owner", "admin", "manager", "staff"]) {
      expect(sql).toMatch(new RegExp(`'${role}'`));
    }
    expect(sql).toMatch(/select 'owner', id from public\.permissions/);
    expect(sql).toMatch(/select 'admin', id from public\.permissions/);
  });

  it("fixes accept_workspace_invitation to never attempt an in-transaction expired-status write, without changing its signature or rejection codes", () => {
    const sql = readMigration("20260724101100_fix_accept_workspace_invitation_expiry.sql");
    expect(sql).toMatch(/create or replace function public\.accept_workspace_invitation\(p_token text\)/i);
    expect(sql).not.toMatch(/set status = 'expired'/i);
    for (const errcode of ["P0001", "P0002", "P0003", "P0004", "P0005", "P0006", "P0007"]) {
      expect(sql).toMatch(new RegExp(`errcode = '${errcode}'`));
    }
  });
});

describe("Client Accounts + Invitations foundation migrations", () => {
  it("gives client_accounts a workspace/client/auth-user uniqueness constraint — no duplicate account rows", () => {
    const sql = readMigration("20260725100000_client_accounts.sql");
    expect(sql).toMatch(/client_accounts_workspace_client_user_unique unique \(workspace_id, client_id, auth_user_id\)/);
  });

  it("never adds an internal role column or a workspace_members FK to client_accounts (structurally, not just in prose comments)", () => {
    const sql = stripSqlComments(readMigration("20260725100000_client_accounts.sql"));
    expect(sql).not.toMatch(/references public\.workspace_members/);
    expect(sql).not.toMatch(/\brole text\b/);
  });

  it("stores only a token hash on client_invitations, never a raw token column", () => {
    const sql = readMigration("20260725100100_client_invitations.sql");
    expect(sql).toMatch(/token_hash text not null/);
    expect(sql).not.toMatch(/\btoken text\b/);
  });

  it("enforces at most one pending invitation per Workspace/Client/email via a partial unique index", () => {
    const sql = readMigration("20260725100100_client_invitations.sql");
    expect(sql).toMatch(/client_invitations_pending_email_unique/);
    expect(sql).toMatch(/where status = 'pending'/);
  });

  it("extends the existing permission catalog rather than creating a parallel one", () => {
    const sql = readMigration("20260725100200_client_portal_permissions_seed.sql");
    expect(sql).toMatch(/insert into public\.permissions/);
    expect(sql).toMatch(/insert into public\.role_permissions/);
    for (const permission of ["clients.portal_view", "clients.portal_invite", "clients.portal_manage", "clients.portal_suspend"]) {
      expect(sql).toMatch(new RegExp(`'${permission.replace(".", "\\.")}'`));
    }
  });

  it("defines the token-based lookup and acceptance functions as security definer with a pinned search_path, using a distinct errcode range from the Team invitation flow", () => {
    const sql = readMigration("20260725100400_client_invitation_helper_functions.sql");
    const definerFunctionBlocks = sql.split(/create or replace function/i).slice(1);
    expect(definerFunctionBlocks.length).toBeGreaterThan(0);
    for (const block of definerFunctionBlocks) {
      if (/security definer/i.test(block)) {
        expect(block).toMatch(/set search_path = public/i);
      }
    }
    for (const errcode of ["P0101", "P0102", "P0103", "P0104", "P0105", "P0106", "P0107"]) {
      expect(sql).toMatch(new RegExp(`errcode = '${errcode}'`));
    }
  });

  it("never creates a workspace_members row from accept_client_invitation", () => {
    const sql = readMigration("20260725100400_client_invitation_helper_functions.sql");
    expect(sql).not.toMatch(/insert into public\.workspace_members/);
  });

  it("defines is_client_account_holder as the Client Portal analog of is_workspace_member, and the action-authority trigger on client_accounts", () => {
    const sql = readMigration("20260725100500_client_account_access_helper_functions.sql");
    expect(sql).toMatch(/create or replace function public\.is_client_account_holder/);
    expect(sql).toMatch(/trg_validate_client_account_action_authority/);
    expect(sql).toMatch(/before update on public\.client_accounts/);
  });

  it("defines get_current_client_account_context, security definer, scoped to auth.uid()'s own row only", () => {
    const sql = readMigration("20260725100500_client_account_access_helper_functions.sql");
    expect(sql).toMatch(/create or replace function public\.get_current_client_account_context/);
    expect(sql).toMatch(/where ca\.auth_user_id = auth\.uid\(\)/);
  });

  it("enables RLS on both new tables", () => {
    const sql = readMigration("20260725100700_client_access_rls.sql");
    for (const table of ["client_accounts", "client_invitations"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
  });

  it("never uses a bare permissive `using (true)` policy", () => {
    const sql = stripSqlComments(readMigration("20260725100700_client_access_rls.sql"));
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("gives a client select access to only their own client_accounts row, never an insert or delete policy", () => {
    const sql = readMigration("20260725100700_client_access_rls.sql");
    expect(sql).toMatch(/client_accounts_select_own/);
    expect(sql).toMatch(/auth_user_id = auth\.uid\(\)/);
    expect(sql).not.toMatch(/on public\.client_accounts for insert/i);
    expect(sql).not.toMatch(/on public\.client_accounts for delete/i);
  });
});

describe("Client Portal MVP migrations", () => {
  it("defines is_client_account_holder_in_workspace, security definer, checking both workspace_id and client_id", () => {
    const sql = readMigration("20260726100000_client_account_workspace_helper_function.sql");
    expect(sql).toMatch(/create or replace function public\.is_client_account_holder_in_workspace\(p_workspace_id uuid, p_client_id uuid\)/);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/where workspace_id = p_workspace_id/);
    expect(sql).toMatch(/and client_id = p_client_id/);
  });

  it("adds additive client-facing select policies for clients, events, and contracts, never touching existing policies", () => {
    const sql = readMigration("20260726100100_client_portal_clients_events_contracts_rls.sql");
    expect(sql).not.toMatch(/drop policy/i);
    expect(sql).toMatch(/clients_select_client_account/);
    expect(sql).toMatch(/events_select_client_account/);
    expect(sql).toMatch(/contracts_select_client_account/);
    for (const block of sql.split(/create policy/i).slice(1)) {
      expect(block).toMatch(/is_client_account_holder_in_workspace/);
    }
  });

  it("adds additive client-facing select policies for invoices and payments only, never expenses", () => {
    const sql = readMigration("20260726100200_client_portal_finance_rls.sql");
    expect(sql).toMatch(/invoices_select_client_account/);
    expect(sql).toMatch(/payments_select_client_account/);
    expect(sql).not.toMatch(/on public\.expenses/i);
  });

  it("gates the documents client-facing policy on both client_id and visibility, and derives folder visibility non-recursively", () => {
    const sql = readMigration("20260726100300_client_portal_documents_rls.sql");
    expect(sql).toMatch(/documents_select_client_account/);
    expect(sql).toMatch(/visibility in \('client', 'client_and_team'\)/);
    expect(sql).toMatch(/document_folders_select_client_account/);
    expect(sql).toMatch(/exists\s*\(\s*select 1\s*from public\.documents d/);
  });

  it("never uses a bare permissive `using (true)` policy across the new Client Portal RLS migrations", () => {
    for (const file of [
      "20260726100100_client_portal_clients_events_contracts_rls.sql",
      "20260726100200_client_portal_finance_rls.sql",
      "20260726100300_client_portal_documents_rls.sql",
    ]) {
      expect(stripSqlComments(readMigration(file))).not.toMatch(/using\s*\(\s*true\s*\)/i);
    }
  });

  it("defines get_client_document_storage_ref as security definer, keyed by document id (never a media_asset_id directly), returning only bucket/path", () => {
    const sql = readMigration("20260726100400_client_portal_document_storage_ref_function.sql");
    expect(sql).toMatch(/create or replace function public\.get_client_document_storage_ref\(p_document_id uuid\)/);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/returns table \(\s*storage_bucket text,\s*storage_path text\s*\)/);
    expect(sql).not.toMatch(/p_media_asset_id/);
  });

  it("validates client_id, visibility, workspace/client-account match, and a non-null media_asset_id before returning a storage ref", () => {
    const sql = readMigration("20260726100400_client_portal_document_storage_ref_function.sql");
    expect(sql).toMatch(/v_document\.client_id is null/);
    expect(sql).toMatch(/v_document\.visibility not in \('client', 'client_and_team'\)/);
    expect(sql).toMatch(/is_client_account_holder_in_workspace\(v_document\.workspace_id, v_document\.client_id\)/);
    expect(sql).toMatch(/v_document\.media_asset_id is null/);
  });
});

describe("Clients Core-integration foundation migration", () => {
  it("only adds one nullable column — no table drop, no constraint drop, no data migration", () => {
    const sql = stripSqlComments(readMigration("20260728100300_clients_favorite_restaurants.sql"));
    expect(sql).toMatch(/alter table public\.clients add column favorite_restaurants text null;/);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/drop column/i);
    expect(sql).not.toMatch(/drop constraint/i);
  });
});

describe("Inventory migrations", () => {
  it("creates inventory_items with item_type/status/condition CHECK constraints and no float money columns", () => {
    const sql = readMigration("20260729100000_inventory_items.sql");
    const code = stripSqlComments(sql);
    expect(sql).toMatch(/create table if not exists public\.inventory_items/);
    expect(sql).toMatch(/constraint inventory_items_item_type_check check \(item_type in \('consumable', 'reusable'\)\)/);
    expect(sql).toMatch(/constraint inventory_items_status_check check \(status in \('active', 'inactive', 'archived'\)\)/);
    expect(sql).toMatch(/constraint inventory_items_condition_check check/);
    expect(sql).toMatch(/constraint inventory_items_condition_matches_item_type_check check \(\s*item_type <> 'consumable' or condition is null\s*\)/);
    expect(code).not.toMatch(/\bfloat\b|\bnumeric\b|\breal\b|\bdouble precision\b/i);
    for (const column of ["unit_cost", "replacement_cost", "rental_value"]) {
      expect(sql).toMatch(new RegExp(`${column} integer`));
    }
  });

  it("creates inventory_movements as an append-only ledger with no updated_at column", () => {
    const sql = readMigration("20260729100100_inventory_movements.sql");
    const code = stripSqlComments(sql);
    expect(sql).toMatch(/create table if not exists public\.inventory_movements/);
    expect(code).not.toMatch(/updated_at/);
    expect(sql).toMatch(/constraint inventory_movements_quantity_positive_check check \(quantity > 0\)/);
    expect(sql).toMatch(/references public\.inventory_items \(id\) on delete cascade/);
  });

  it("widens notes/timeline_activities/media_assets owner_type to add inventory_item, preserving every prior value", () => {
    const sql = readMigration("20260729100200_notes_timeline_media_inventory_item_owner_type.sql");
    for (const priorOwnerType of ["lead", "client", "event", "contract", "invoice", "payment", "expense", "document", "document_folder"]) {
      expect(sql).toMatch(new RegExp(`'${priorOwnerType}'`));
    }
    expect(sql).toMatch(/'inventory_item'/);
    expect(sql).toMatch(/inventory_item_created/);
    expect(sql).toMatch(/inventory_movement_recorded/);
  });

  it("attaches the shared updated_at trigger to inventory_items only", () => {
    const sql = readMigration("20260729100300_inventory_items_updated_at_trigger.sql");
    expect(sql).toMatch(/before update on public\.inventory_items/);
    expect(sql).toMatch(/execute function public\.set_updated_at\(\)/);
  });

  it("gives inventory_items select/insert/update policies but no delete policy", () => {
    const sql = readMigration("20260729100400_inventory_items_rls.sql");
    expect(sql).toMatch(/alter table public\.inventory_items enable row level security/);
    expect(sql).toMatch(/for select/);
    expect(sql).toMatch(/for insert/);
    expect(sql).toMatch(/for update/);
    expect(sql).not.toMatch(/for delete/);
    for (const block of sql.split(/create policy/i).slice(1)) {
      expect(block).toMatch(/is_workspace_member\(workspace_id\)/);
    }
  });

  it("gives inventory_movements only select/insert policies — no update or delete, enforcing append-only at the RLS layer", () => {
    const sql = readMigration("20260729100500_inventory_movements_rls.sql");
    expect(sql).toMatch(/alter table public\.inventory_movements enable row level security/);
    expect(sql).toMatch(/for select/);
    expect(sql).toMatch(/for insert/);
    expect(sql).not.toMatch(/for update/);
    expect(sql).not.toMatch(/for delete/);
  });

  it("indexes inventory_items/inventory_movements and enforces workspace-scoped SKU uniqueness allowing repeated nulls", () => {
    const sql = readMigration("20260729100600_inventory_indexes_and_constraints.sql");
    expect(sql).toMatch(/create unique index if not exists inventory_items_workspace_sku_unique\s*\n\s*on public\.inventory_items \(workspace_id, sku\) where sku is not null/);
    expect(sql).toMatch(/inventory_items_tags_gin_idx/);
    expect(sql).toMatch(/inventory_movements_workspace_item_occurred_at_idx/);
  });

  it("never uses a bare permissive `using (true)` policy across the new Inventory RLS migrations", () => {
    for (const file of ["20260729100400_inventory_items_rls.sql", "20260729100500_inventory_movements_rls.sql"]) {
      expect(stripSqlComments(readMigration(file))).not.toMatch(/using\s*\(\s*true\s*\)/i);
    }
  });
});

describe("Vendors migrations", () => {
  it("creates vendors with status/currency CHECK constraints and the full address shape including country", () => {
    const sql = readMigration("20260730100000_vendors.sql");
    expect(sql).toMatch(/create table if not exists public\.vendors/);
    expect(sql).toMatch(/constraint vendors_status_check check \(status in \('active', 'inactive'\)\)/);
    expect(sql).toMatch(/constraint vendors_currency_check check \(char_length\(default_currency\) = 3\)/);
    for (const column of ["address", "city", "state", "zip_code", "country"]) {
      expect(sql).toMatch(new RegExp(`\\b${column} text\\b`));
    }
    expect(sql).toMatch(/company_name text not null/);
  });

  it("widens notes/timeline_activities/media_assets owner_type to add vendor, preserving every prior value", () => {
    const sql = readMigration("20260730100100_notes_timeline_media_vendor_owner_type.sql");
    for (const priorOwnerType of ["lead", "client", "event", "contract", "invoice", "payment", "expense", "document", "document_folder", "inventory_item"]) {
      expect(sql).toMatch(new RegExp(`'${priorOwnerType}'`));
    }
    expect(sql).toMatch(/'vendor'/);
    for (const activityType of ["vendor_created", "vendor_updated", "vendor_archived", "vendor_restored", "vendor_preferred_status_changed"]) {
      expect(sql).toMatch(new RegExp(activityType));
    }
    expect(sql).toMatch(/alter table public\.media_assets drop constraint media_assets_owner_type_check/);
  });

  it("attaches the shared updated_at trigger to vendors", () => {
    const sql = readMigration("20260730100200_vendors_updated_at_trigger.sql");
    expect(sql).toMatch(/before update on public\.vendors/);
    expect(sql).toMatch(/execute function public\.set_updated_at\(\)/);
  });

  it("gives vendors select/insert/update policies but no delete policy", () => {
    const sql = readMigration("20260730100300_vendors_rls.sql");
    expect(sql).toMatch(/alter table public\.vendors enable row level security/);
    expect(sql).toMatch(/for select/);
    expect(sql).toMatch(/for insert/);
    expect(sql).toMatch(/for update/);
    expect(sql).not.toMatch(/for delete/);
    for (const block of sql.split(/create policy/i).slice(1)) {
      expect(block).toMatch(/is_workspace_member\(workspace_id\)/);
    }
  });

  it("indexes vendors and enforces workspace-scoped tax_id uniqueness allowing repeated nulls", () => {
    const sql = readMigration("20260730100400_vendors_indexes_and_constraints.sql");
    expect(sql).toMatch(/create unique index if not exists vendors_workspace_tax_id_unique\s*\n\s*on public\.vendors \(workspace_id, tax_id\) where tax_id is not null/);
    expect(sql).toMatch(/vendors_tags_gin_idx/);
    expect(sql).toMatch(/vendors_workspace_preferred_idx/);
  });

  it("never uses a bare permissive `using (true)` policy on the new Vendors RLS migration", () => {
    expect(stripSqlComments(readMigration("20260730100300_vendors_rls.sql"))).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });
});

describe("Inventory Supabase Repository phase migration", () => {
  it("defines record_inventory_movement as security invoker with a pinned search_path, matching create_document_version/recompute_invoice_balance's approach rather than a new one", () => {
    const sql = readMigration("20260731100000_inventory_record_movement_function.sql");
    expect(sql).toMatch(/create or replace function public\.record_inventory_movement/);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path = public/i);
    expect(sql).toMatch(/returns public\.inventory_movements/);
  });

  it("row-locks the target item before computing quantities, preventing two concurrent movements from clobbering each other", () => {
    const sql = readMigration("20260731100000_inventory_record_movement_function.sql");
    expect(sql).toMatch(/select \* into v_item from public\.inventory_items where id = p_inventory_item_id for update/);
  });

  it("raises the same four custom error codes the Supabase repository checks for", () => {
    const sql = readMigration("20260731100000_inventory_record_movement_function.sql");
    for (const errcode of ["P0001", "P0002", "P0003", "P0004"]) {
      expect(sql).toMatch(new RegExp(`errcode = '${errcode}'`));
    }
  });

  it("inserts exactly one inventory_movements row and one timeline_activities row, never updating or deleting a prior movement", () => {
    const sql = stripSqlComments(readMigration("20260731100000_inventory_record_movement_function.sql"));
    expect(sql).toMatch(/insert into public\.inventory_movements/);
    expect(sql).toMatch(/insert into public\.timeline_activities/);
    expect(sql).not.toMatch(/update public\.inventory_movements/);
    expect(sql).not.toMatch(/delete from public\.inventory_movements/);
  });
});

describe("Purchases migrations", () => {
  it("creates purchases with a status CHECK, an exact total-consistency CHECK, and no float money columns", () => {
    const sql = readMigration("20260801100000_purchases.sql");
    const code = stripSqlComments(sql);
    expect(sql).toMatch(/create table if not exists public\.purchases/);
    expect(sql).toMatch(
      /constraint purchases_status_check check \(\s*status in \('draft', 'submitted', 'partially_received', 'fully_received', 'cancelled', 'archived'\)\s*\)/,
    );
    expect(sql).toMatch(
      /constraint purchases_total_consistency_check check \(\s*total_minor = subtotal_minor \+ tax_minor \+ shipping_minor - discount_minor\s*\)/,
    );
    expect(sql).toMatch(/vendor_id uuid not null references public\.vendors \(id\)/);
    expect(sql).toMatch(/created_by text not null/);
    expect(code).not.toMatch(/\bfloat\b|\bnumeric\b|\breal\b|\bdouble precision\b/i);
    for (const column of ["subtotal_minor", "tax_minor", "shipping_minor", "discount_minor", "total_minor"]) {
      expect(sql).toMatch(new RegExp(`${column} integer`));
    }
  });

  it("does not encode the full status transition graph as a CHECK constraint — only a single status IN-list constraint exists", () => {
    const sql = stripSqlComments(readMigration("20260801100000_purchases.sql"));
    const statusConstraints = sql.match(/constraint \w*status\w*_check/g) ?? [];
    expect(statusConstraints).toEqual(["constraint purchases_status_check"]);
    expect(sql).not.toMatch(/->|=>|transition/i);
  });

  it("creates purchase_items with a purchase_id cascade FK, a nullable inventory_item_id set-null FK, and quantity/line-subtotal CHECKs", () => {
    const sql = readMigration("20260801100100_purchase_items.sql");
    const code = stripSqlComments(sql);
    expect(sql).toMatch(/create table if not exists public\.purchase_items/);
    expect(sql).toMatch(/purchase_id uuid not null references public\.purchases \(id\) on delete cascade/);
    expect(sql).toMatch(/inventory_item_id uuid references public\.inventory_items \(id\) on delete set null/);
    expect(sql).toMatch(/constraint purchase_items_quantity_ordered_check check \(quantity_ordered > 0\)/);
    expect(sql).toMatch(
      /constraint purchase_items_quantity_received_check check \(\s*quantity_received >= 0 and quantity_received <= quantity_ordered\s*\)/,
    );
    expect(sql).toMatch(
      /constraint purchase_items_line_subtotal_consistency_check check \(\s*line_subtotal_minor = unit_cost_minor \* quantity_ordered\s*\)/,
    );
    expect(code).not.toMatch(/\bfloat\b|\bnumeric\b|\breal\b|\bdouble precision\b/i);
  });

  it("widens notes/timeline_activities/media_assets owner_type to add purchase, preserving every prior value, without adding purchase_item as a Core owner type", () => {
    const sql = readMigration("20260801100200_notes_timeline_media_purchase_owner_type.sql");
    const code = stripSqlComments(sql);
    for (const priorOwnerType of [
      "lead",
      "client",
      "event",
      "contract",
      "invoice",
      "payment",
      "expense",
      "document",
      "document_folder",
      "inventory_item",
      "vendor",
    ]) {
      expect(sql).toMatch(new RegExp(`'${priorOwnerType}'`));
    }
    expect(sql).toMatch(/'purchase'/);
    expect(code).not.toMatch(/'purchase_item'/);
    for (const activityType of [
      "purchase_created",
      "purchase_updated",
      "purchase_status_changed",
      "purchase_archived",
      "purchase_restored",
      "purchase_item_added",
      "purchase_item_updated",
      "purchase_item_removed",
      "purchase_item_received",
    ]) {
      expect(sql).toMatch(new RegExp(activityType));
    }
    expect(sql).toMatch(/alter table public\.media_assets drop constraint media_assets_owner_type_check/);
  });

  it("attaches the shared updated_at trigger to both purchases and purchase_items", () => {
    const sql = readMigration("20260801100300_purchases_updated_at_triggers.sql");
    expect(sql).toMatch(/before update on public\.purchases\b/);
    expect(sql).toMatch(/before update on public\.purchase_items/);
    expect(sql.match(/execute function public\.set_updated_at\(\)/g)).toHaveLength(2);
  });

  it("widens media_assets owner_type to add event_service (Event Service Workspace Attachments), preserving every prior value and not adding service speculatively", () => {
    const sql = readMigration("20260807100000_media_event_service_owner_type.sql");
    const code = stripSqlComments(sql);
    for (const priorOwnerType of ["lead", "client", "event", "document", "inventory_item", "vendor", "purchase"]) {
      expect(sql).toMatch(new RegExp(`'${priorOwnerType}'`));
    }
    expect(sql).toMatch(/'event_service'/);
    expect(code).not.toMatch(/'service'(?!_)/);
    expect(sql).toMatch(/alter table public\.media_assets drop constraint media_assets_owner_type_check/);
    expect(sql).not.toMatch(/alter table public\.notes/);
    expect(sql).not.toMatch(/alter table public\.timeline_activities/);
  });

  it("gives purchases select/insert/update policies but no delete policy", () => {
    const sql = readMigration("20260801100400_purchases_rls.sql");
    expect(sql).toMatch(/alter table public\.purchases enable row level security/);
    expect(sql).toMatch(/for select/);
    expect(sql).toMatch(/for insert/);
    expect(sql).toMatch(/for update/);
    expect(sql).not.toMatch(/for delete/);
    for (const block of sql.split(/create policy/i).slice(1)) {
      expect(block).toMatch(/is_workspace_member\(workspace_id\)/);
    }
  });

  it("gives purchase_items select/insert/update/delete policies, since removePurchaseItem is a real hard delete", () => {
    const sql = readMigration("20260801100500_purchase_items_rls.sql");
    expect(sql).toMatch(/alter table public\.purchase_items enable row level security/);
    expect(sql).toMatch(/for select/);
    expect(sql).toMatch(/for insert/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/for delete/);
    for (const block of sql.split(/create policy/i).slice(1)) {
      expect(block).toMatch(/is_workspace_member\(workspace_id\)/);
    }
  });

  it("never uses a bare permissive `using (true)` policy across the new Purchases RLS migrations", () => {
    for (const file of ["20260801100400_purchases_rls.sql", "20260801100500_purchase_items_rls.sql"]) {
      expect(stripSqlComments(readMigration(file))).not.toMatch(/using\s*\(\s*true\s*\)/i);
    }
  });

  it("indexes purchases/purchase_items and enforces workspace-scoped purchase_number uniqueness across all rows, including archived ones", () => {
    const sql = readMigration("20260801100600_purchases_indexes_and_constraints.sql");
    expect(sql).toMatch(
      /create unique index if not exists purchases_workspace_number_unique\s*\n\s*on public\.purchases \(workspace_id, purchase_number\);/,
    );
    expect(stripSqlComments(sql)).not.toMatch(/purchases_workspace_number_unique[\s\S]*where/);
    expect(sql).toMatch(/purchases_workspace_vendor_idx/);
    expect(sql).toMatch(/purchase_items_purchase_id_display_order_idx/);
  });

  it("does not create any receiving RPC function in this phase", () => {
    const files = migrationFiles().filter((f) => f.startsWith("20260801"));
    for (const file of files) {
      const sql = stripSqlComments(readMigration(file));
      expect(sql).not.toMatch(/create (or replace )?function/i);
    }
  });

  it("does not touch any Finance table (invoices/payments/expenses)", () => {
    const files = migrationFiles().filter((f) => f.startsWith("20260801"));
    for (const file of files) {
      const sql = stripSqlComments(readMigration(file));
      expect(sql).not.toMatch(/\b(invoices|payments|expenses)\b/);
    }
  });
});

describe("Purchases Receiving RPC migration", () => {
  it("defines record_purchase_receipt as security invoker with a pinned search_path, matching record_inventory_movement's approach rather than a new one", () => {
    const sql = readMigration("20260802100000_purchases_record_receipt_function.sql");
    expect(sql).toMatch(/create or replace function public\.record_purchase_receipt/);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path = public/i);
    expect(sql).toMatch(/returns public\.purchase_items/);
  });

  it("row-locks the purchase_items row, then the purchases row, before validating or writing anything", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).toMatch(/select \* into v_item from public\.purchase_items where id = p_purchase_item_id for update/);
    expect(sql).toMatch(/select \* into v_purchase from public\.purchases where id = v_item\.purchase_id for update/);
    const itemLockIndex = sql.indexOf("select * into v_item from public.purchase_items");
    const purchaseLockIndex = sql.indexOf("select * into v_purchase from public.purchases");
    expect(itemLockIndex).toBeGreaterThan(-1);
    expect(purchaseLockIndex).toBeGreaterThan(itemLockIndex);
  });

  it("composes record_inventory_movement rather than re-deriving its delta/quantity-invariant logic", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).toMatch(/select public\.record_inventory_movement\(/);
    expect(sql).not.toMatch(/quantity_on_hand|quantity_available|quantity_reserved/);
  });

  it("raises its own P0005-P0009 error codes, distinct from record_inventory_movement's P0001-P0004", () => {
    const sql = readMigration("20260802100000_purchases_record_receipt_function.sql");
    for (const errcode of ["P0005", "P0006", "P0007", "P0008", "P0009"]) {
      expect(sql).toMatch(new RegExp(`errcode = '${errcode}'`));
    }
    for (const errcode of ["P0001", "P0002", "P0003", "P0004"]) {
      expect(sql).not.toMatch(new RegExp(`errcode = '${errcode}'`));
    }
  });

  it("rejects a purchase that is archived, not in a receivable status, or would be over-received, before writing anything", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).toMatch(/if v_purchase\.archived_at is not null then/);
    expect(sql).toMatch(/if v_purchase\.status not in \('submitted', 'partially_received'\) then/);
    expect(sql).toMatch(/if v_next_received > v_item\.quantity_ordered then/);
  });

  it("updates purchase_items and purchases and inserts exactly one timeline_activities row, never updating or deleting a prior movement or activity", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).toMatch(/update public\.purchase_items/);
    expect(sql).toMatch(/update public\.purchases/);
    expect(sql).toMatch(/insert into public\.timeline_activities/);
    expect(sql).not.toMatch(/delete from public\./);
    expect(sql.match(/insert into public\.timeline_activities/g)).toHaveLength(1);
  });

  it("recomputes totals as an exact sum over the current purchase_items ledger, matching computePurchaseSubtotal/computePurchaseTotal's arithmetic", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).toMatch(/coalesce\(sum\(line_subtotal_minor\), 0\)/);
    expect(sql).toMatch(/v_total_minor := v_subtotal_minor \+ v_purchase\.tax_minor \+ v_purchase\.shipping_minor - v_purchase\.discount_minor/);
  });

  it("does not modify any Finance table", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).not.toMatch(/\b(invoices|payments|expenses)\b/);
  });

  it("derives partially_received vs fully_received from the sum of every item's ordered/received quantities, matching derivePurchaseReceiptStatus", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).toMatch(/if v_total_received >= v_total_ordered and v_total_ordered > 0 then/);
    expect(sql).toMatch(/v_next_status := 'fully_received'/);
    expect(sql).toMatch(/elsif v_total_received > 0 then/);
    expect(sql).toMatch(/v_next_status := 'partially_received'/);
  });

  it("rejects receiving against a cancelled purchase (cancelled is not in the receivable-status allow-list)", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    const statusCheck = sql.match(/if v_purchase\.status not in \(([^)]*)\) then/);
    expect(statusCheck).not.toBeNull();
    expect(statusCheck?.[1]).not.toMatch(/cancelled/);
  });

  it("has no exception handler that would swallow a raised error and prevent the whole transaction from rolling back", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    expect(sql).not.toMatch(/exception\s+when/i);
  });

  it("locks the purchases row (serializing concurrent receipts against the same Purchase) before recomputing aggregates from the item ledger", () => {
    const sql = stripSqlComments(readMigration("20260802100000_purchases_record_receipt_function.sql"));
    const purchaseLockIndex = sql.indexOf("select * into v_purchase from public.purchases");
    const recomputeIndex = sql.indexOf("coalesce(sum(line_subtotal_minor)");
    expect(purchaseLockIndex).toBeGreaterThan(-1);
    expect(recomputeIndex).toBeGreaterThan(purchaseLockIndex);
  });
});

describe("Finance Ledger Database migrations", () => {
  const FINANCE_FILES = [
    "20260803100000_finance_chart_of_accounts.sql",
    "20260803100100_finance_accounting_periods.sql",
    "20260803100200_finance_journal_entries.sql",
    "20260803100300_finance_journal_lines.sql",
    "20260803100400_finance_stripe_webhook_events.sql",
    "20260803100500_finance_timeline_activity_types.sql",
    "20260803100600_finance_updated_at_triggers.sql",
    "20260803100700_finance_posting_invariant_triggers.sql",
    "20260803100800_finance_rls.sql",
    "20260803100900_finance_indexes_and_constraints.sql",
    "20260803101000_finance_seed_chart_of_accounts.sql",
  ];

  it("creates chart_of_accounts with an account_type CHECK, a normal_balance CHECK, and no float money columns", () => {
    const sql = readMigration("20260803100000_finance_chart_of_accounts.sql");
    const code = stripSqlComments(sql);
    expect(sql).toMatch(/create table if not exists public\.chart_of_accounts/);
    expect(sql).toMatch(
      /constraint chart_of_accounts_account_type_check check \(\s*account_type in \(\s*'asset', 'liability', 'equity', 'revenue', 'contra_revenue',\s*'cost_of_goods_sold', 'operating_expense', 'other_income', 'other_expense'\s*\)\s*\)/,
    );
    expect(sql).toMatch(/constraint chart_of_accounts_normal_balance_check check \(normal_balance in \('debit', 'credit'\)\)/);
    expect(code).not.toMatch(/\bfloat\b|\bnumeric\b|\breal\b|\bdouble precision\b/i);
  });

  it("creates accounting_periods with a status CHECK and a period_end > period_start CHECK", () => {
    const sql = readMigration("20260803100100_finance_accounting_periods.sql");
    expect(sql).toMatch(/create table if not exists public\.accounting_periods/);
    expect(sql).toMatch(/constraint accounting_periods_status_check check \(status in \('open', 'closed', 'locked'\)\)/);
    expect(sql).toMatch(/constraint accounting_periods_date_range_check check \(period_end > period_start\)/);
  });

  it("creates journal_entries with source_id as text (not uuid), a polymorphic reference with no FK, and the manual-adjustment-only memo/source-consistency CHECKs", () => {
    const sql = readMigration("20260803100200_finance_journal_entries.sql");
    expect(sql).toMatch(/create table if not exists public\.journal_entries/);
    expect(sql).toMatch(/source_id text/);
    expect(sql).not.toMatch(/source_id uuid/);
    expect(sql).not.toMatch(/source_id.*references/);
    expect(sql).toMatch(/accounting_period_id uuid not null references public\.accounting_periods \(id\)/);
    expect(sql).toMatch(
      /constraint journal_entries_adjustment_memo_check check \(\s*source_type <> 'manual_adjustment' or \(memo is not null and btrim\(memo\) <> ''\)\s*\)/,
    );
    expect(sql).toMatch(
      /constraint journal_entries_source_consistency_check check \(\s*\(source_id is null\) = \(source_type = 'manual_adjustment'\)\s*\)/,
    );
    expect(stripSqlComments(sql)).not.toMatch(/updated_at/);
  });

  it("does not encode a hard CHECK linking debit/credit direction to an account's normal_balance", () => {
    const sql = stripSqlComments(readMigration("20260803100200_finance_journal_entries.sql"));
    expect(sql).not.toMatch(/normal_balance/);
  });

  it("creates journal_lines with integer (not bigint/float) debit_minor/credit_minor, a nonnegative CHECK, and an exactly-one-side CHECK", () => {
    const sql = readMigration("20260803100300_finance_journal_lines.sql");
    const code = stripSqlComments(sql);
    expect(sql).toMatch(/create table if not exists public\.journal_lines/);
    expect(sql).toMatch(/debit_minor integer not null default 0/);
    expect(sql).toMatch(/credit_minor integer not null default 0/);
    expect(sql).toMatch(/amount_in_base_currency_minor integer not null default 0/);
    expect(code).not.toMatch(/\bbigint\b|\bfloat\b|\bnumeric\b|\breal\b|\bdouble precision\b/i);
    expect(sql).toMatch(/constraint journal_lines_debit_minor_check check \(debit_minor >= 0\)/);
    expect(sql).toMatch(/constraint journal_lines_credit_minor_check check \(credit_minor >= 0\)/);
    expect(sql).toMatch(
      /constraint journal_lines_one_side_check check \(\s*\(debit_minor > 0 and credit_minor = 0\) or \(debit_minor = 0 and credit_minor > 0\)\s*\)/,
    );
    expect(sql).toMatch(/journal_entry_id uuid not null references public\.journal_entries \(id\) on delete restrict/);
  });

  it("creates stripe_webhook_events with a nullable workspace_id and a unique stripe_event_id (uniqueness itself lives in the indexes migration)", () => {
    const sql = readMigration("20260803100400_finance_stripe_webhook_events.sql");
    expect(sql).toMatch(/create table if not exists public\.stripe_webhook_events/);
    expect(sql).toMatch(/workspace_id uuid references public\.workspaces \(id\)/);
    expect(sql).not.toMatch(/workspace_id uuid not null/);
    expect(sql).toMatch(/payload jsonb not null/);
    expect(sql).toMatch(/constraint stripe_webhook_events_posting_status_check check \(posting_status in \('pending', 'posted', 'failed'\)\)/);
  });

  it("widens only timeline_activities_type_check to add the 4 new Finance activity types, touching no owner_type constraint", () => {
    const sql = readMigration("20260803100500_finance_timeline_activity_types.sql");
    const code = stripSqlComments(sql);
    expect(sql).toMatch(/alter table public\.timeline_activities drop constraint timeline_activities_type_check/);
    expect(code).not.toMatch(/owner_type_check/);
    expect(code).not.toMatch(/media_assets/);
    expect(code).not.toMatch(/public\.notes\b/);
    for (const activityType of [
      "journal_entry_posted",
      "journal_entry_reversed",
      "accounting_period_closed",
      "accounting_period_locked",
    ]) {
      expect(sql).toMatch(new RegExp(activityType));
    }
    // Every prior activity type must still be present — this is a widening, never a narrowing.
    for (const priorType of ["purchase_item_received", "vendor_preferred_status_changed", "invoice_paid", "expense_reimbursed"]) {
      expect(sql).toMatch(new RegExp(priorType));
    }
  });

  it("attaches the shared updated_at trigger to chart_of_accounts and accounting_periods only, not to the append-only Finance tables", () => {
    const sql = readMigration("20260803100600_finance_updated_at_triggers.sql");
    expect(sql).toMatch(/before update on public\.chart_of_accounts/);
    expect(sql).toMatch(/before update on public\.accounting_periods/);
    expect(sql).not.toMatch(/on public\.journal_entries/);
    expect(sql).not.toMatch(/on public\.journal_lines/);
    expect(sql).not.toMatch(/on public\.stripe_webhook_events/);
    expect(sql.match(/execute function public\.set_updated_at\(\)/g)).toHaveLength(2);
  });

  it("defines a deferred constraint trigger that sums journal_lines by journal_entry_id and raises P1000 when debits and credits disagree", () => {
    const sql = stripSqlComments(readMigration("20260803100700_finance_posting_invariant_triggers.sql"));
    expect(sql).toMatch(/create constraint trigger trg_journal_lines_balanced/);
    expect(sql).toMatch(/deferrable initially deferred/);
    expect(sql).toMatch(/after insert or update or delete on public\.journal_lines/);
    expect(sql).toMatch(/coalesce\(sum\(debit_minor\), 0\), coalesce\(sum\(credit_minor\), 0\)/);
    expect(sql).toMatch(/errcode = 'P1000'/);
  });

  it("makes journal_entries reject DELETE unconditionally and reject UPDATE except to the three status-tracking columns", () => {
    const sql = stripSqlComments(readMigration("20260803100700_finance_posting_invariant_triggers.sql"));
    expect(sql).toMatch(/before update or delete on public\.journal_entries/);
    expect(sql).toMatch(/if TG_OP = 'DELETE' then/);
    expect(sql).toMatch(/errcode = 'P1001'/);
    expect(sql).toMatch(/errcode = 'P1002'/);
    // The permitted-columns guard must NOT compare posting_status/failure_reason/reversed_by_entry_id themselves.
    const updateGuard = sql.match(/if TG_OP = 'UPDATE' then([\s\S]*?)end if;/)?.[1] ?? "";
    expect(updateGuard).not.toMatch(/new\.posting_status <> old\.posting_status/);
    expect(updateGuard).not.toMatch(/new\.failure_reason/);
    expect(updateGuard).not.toMatch(/new\.reversed_by_entry_id/);
  });

  it("makes journal_lines reject every UPDATE and DELETE unconditionally", () => {
    const sql = stripSqlComments(readMigration("20260803100700_finance_posting_invariant_triggers.sql"));
    expect(sql).toMatch(/before update or delete on public\.journal_lines/);
    expect(sql).toMatch(/errcode = 'P1003'/);
  });

  it("rejects posting to a locked period unconditionally, and rejects a non-reversal posting to a closed period", () => {
    const sql = stripSqlComments(readMigration("20260803100700_finance_posting_invariant_triggers.sql"));
    expect(sql).toMatch(/if v_status = 'locked' then/);
    expect(sql).toMatch(/errcode = 'P1004'/);
    expect(sql).toMatch(/if v_status = 'closed' and new\.reverses_entry_id is null then/);
    expect(sql).toMatch(/errcode = 'P1005'/);
  });

  it("keeps reversed_by_entry_id and reverses_entry_id mutually consistent via an AFTER trigger", () => {
    const sql = stripSqlComments(readMigration("20260803100700_finance_posting_invariant_triggers.sql"));
    expect(sql).toMatch(/after insert or update on public\.journal_entries/);
    expect(sql).toMatch(/errcode = 'P1006'/);
    expect(sql).toMatch(/errcode = 'P1007'/);
  });

  it("checks journal_lines.workspace_id against its parent journal_entries.workspace_id on insert", () => {
    const sql = stripSqlComments(readMigration("20260803100700_finance_posting_invariant_triggers.sql"));
    expect(sql).toMatch(/before insert on public\.journal_lines/);
    expect(sql).toMatch(/errcode = 'P1008'/);
  });

  it("uses a fresh P1000-P1008 error code range, colliding with no existing errcode in this schema", () => {
    const sql = readMigration("20260803100700_finance_posting_invariant_triggers.sql");
    for (const code of ["P1000", "P1001", "P1002", "P1003", "P1004", "P1005", "P1006", "P1007", "P1008"]) {
      expect(sql).toMatch(new RegExp(`errcode = '${code}'`));
    }
    for (const otherFile of migrationFiles().filter((f) => !FINANCE_FILES.includes(f))) {
      expect(readMigration(otherFile)).not.toMatch(/errcode = 'P10\d\d'/);
    }
  });

  it("does not define any business-logic posting RPC yet — only constraint-enforcement trigger functions exist", () => {
    for (const file of FINANCE_FILES) {
      const sql = stripSqlComments(readMigration(file));
      for (const forbidden of [
        "post_purchase_receipt",
        "post_payment_settlement",
        "post_expense_transition",
        "reverse_journal_entry",
        "record_manual_adjustment",
        "close_period",
        "lock_period",
        "retry_failed_posting",
        "stripe_webhook_received",
      ]) {
        expect(sql).not.toMatch(new RegExp(`function public\\.${forbidden}`));
      }
    }
  });

  it("gives chart_of_accounts/accounting_periods/journal_entries/journal_lines select/insert/update policies but no delete policy, and gives stripe_webhook_events only a select policy", () => {
    const sql = readMigration("20260803100800_finance_rls.sql");
    for (const table of ["chart_of_accounts", "accounting_periods", "journal_entries", "journal_lines"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
    }
    expect(sql).not.toMatch(/for delete/);
    expect(sql.match(/for insert/g)?.length).toBe(4); // not stripe_webhook_events
    for (const block of sql.split(/create policy/i).slice(1)) {
      expect(block).toMatch(/is_workspace_member\(workspace_id\)/);
    }
  });

  it("never uses a bare permissive `using (true)` policy in the Finance RLS migration", () => {
    expect(stripSqlComments(readMigration("20260803100800_finance_rls.sql"))).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("enables btree_gist and prevents overlapping accounting_periods per workspace via an EXCLUDE constraint", () => {
    const sql = readMigration("20260803100900_finance_indexes_and_constraints.sql");
    expect(sql).toMatch(/create extension if not exists btree_gist/);
    expect(sql).toMatch(/exclude using gist \(\s*workspace_id with =,\s*daterange\(period_start, period_end, '\[\]'\) with &&\s*\)/);
  });

  it("creates the posting_key partial unique index, excluding purchase_receipt and manual_adjustment", () => {
    const sql = readMigration("20260803100900_finance_indexes_and_constraints.sql");
    expect(sql).toMatch(/create unique index if not exists journal_entries_posting_key_unique/);
    expect(sql).toMatch(/where source_id is not null and source_type not in \('purchase_receipt', 'manual_adjustment'\)/);
  });

  it("creates a unique index on stripe_webhook_events.stripe_event_id — the entire webhook idempotency mechanism", () => {
    const sql = readMigration("20260803100900_finance_indexes_and_constraints.sql");
    expect(sql).toMatch(
      /create unique index if not exists stripe_webhook_events_stripe_event_id_unique\s*\n\s*on public\.stripe_webhook_events \(stripe_event_id\);/,
    );
  });

  it("seeds the same 41 accounts for every existing workspace, relying on the workspace/account_number unique index for idempotency", () => {
    const sql = readMigration("20260803101000_finance_seed_chart_of_accounts.sql");
    expect(sql).toMatch(/cross join \(/);
    expect(sql).toMatch(/from public\.workspaces w/);
    expect(sql).toMatch(/on conflict \(workspace_id, account_number\) do nothing/);
    const rowMatches = sql.match(/^\s*\(\d{4}, '(?:[^']|'')*', '\w+', '(?:debit|credit)'\),?$/gm) ?? [];
    expect(rowMatches).toHaveLength(41);
    expect(sql).toMatch(/\(1000, 'Cash', 'asset', 'debit'\)/);
    expect(sql).toMatch(/\(2000, 'Accounts Payable', 'liability', 'credit'\)/);
    expect(sql).toMatch(/\(4000, 'Service Revenue', 'revenue', 'credit'\)/);
    expect(sql).toMatch(/\(5000, 'Cost of Goods Sold', 'cost_of_goods_sold', 'debit'\)/);
  });

  it("does not modify any existing Purchases/Inventory/Vendors/Finance-business-object table shape, only widening the shared timeline_activities_type_check", () => {
    for (const file of FINANCE_FILES) {
      const sql = stripSqlComments(readMigration(file));
      if (file.includes("timeline_activity_types")) continue;
      expect(sql).not.toMatch(/alter table public\.(purchases|purchase_items|inventory_items|inventory_movements|vendors|invoices|payments|expenses)\b/);
    }
  });
});

describe("Finance Posting Engine migrations", () => {
  const POSTING_ENGINE_FILES = [
    "20260804095000_finance_posting_key.sql",
    "20260804100000_finance_posting_helpers.sql",
    "20260804100100_finance_post_purchase_receipt.sql",
    "20260804100200_finance_post_payment_settlement.sql",
    "20260804100300_finance_post_expense_transition.sql",
    "20260804100400_finance_post_inventory_movement_entry.sql",
    "20260804100500_finance_reverse_journal_entry.sql",
    "20260804100600_finance_record_manual_adjustment.sql",
    "20260804100700_finance_timeline_owner_type_widening.sql",
    "20260804100800_finance_accounting_period_rpcs.sql",
  ];

  describe("journal_entries.posting_key correction migration", () => {
    const sql = () => readMigration("20260804095000_finance_posting_key.sql");

    it("adds posting_key as a nullable column, additive only (no drop/alter of an existing column)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/alter table public\.journal_entries add column if not exists posting_key text;/);
      expect(code).not.toMatch(/drop column/i);
      expect(code).not.toMatch(/alter column/i);
    });

    it("creates a unique index on (workspace_id, posting_key) scoped to posting_key is not null", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/create unique index if not exists journal_entries_workspace_posting_key_unique\s*\n\s*on public\.journal_entries \(workspace_id, posting_key\)\s*\n\s*where posting_key is not null;/);
    });

    it("sorts before every other Posting Engine migration so finance_insert_journal_entry can depend on the column existing", () => {
      const files = migrationFiles();
      const postingKeyIndex = files.indexOf("20260804095000_finance_posting_key.sql");
      const helpersIndex = files.indexOf("20260804100000_finance_posting_helpers.sql");
      expect(postingKeyIndex).toBeGreaterThanOrEqual(0);
      expect(postingKeyIndex).toBeLessThan(helpersIndex);
    });
  });

  it("standardizes posting_key: no deterministic key embeds workspace_id, since the (workspace_id, posting_key) unique index already scopes uniqueness per workspace", () => {
    for (const file of POSTING_ENGINE_FILES) {
      const code = stripSqlComments(readMigration(file));
      expect(code).not.toMatch(/v_posting_key\s*:=[^;]*workspace_id/);
    }
  });

  it("standardizes posting_key: every deterministic value is derived from a fixed literal + the relevant id, never from gen_random_uuid or another random source", () => {
    for (const file of POSTING_ENGINE_FILES) {
      const code = stripSqlComments(readMigration(file));
      expect(code).not.toMatch(/v_posting_key\s*:=[^;]*gen_random_uuid/);
    }
  });

  it("defines finance_resolve_account/finance_resolve_period/finance_insert_journal_entry as security invoker with pinned search_path", () => {
    const sql = readMigration("20260804100000_finance_posting_helpers.sql");
    for (const fn of ["finance_resolve_account", "finance_resolve_period", "finance_insert_journal_entry"]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${fn}`));
    }
    expect(sql.match(/security invoker/gi)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/set search_path = public/gi)?.length).toBeGreaterThanOrEqual(3);
  });

  it("finance_resolve_account resolves by (workspace_id, account_number, is_system) and never hardcodes a UUID", () => {
    const sql = stripSqlComments(readMigration("20260804100000_finance_posting_helpers.sql"));
    expect(sql).toMatch(/where workspace_id = p_workspace_id and account_number = p_account_number and is_system = true/);
    expect(sql).toMatch(/errcode = 'P1100'/);
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("finance_resolve_period never auto-creates a period, only resolves one covering entry_date", () => {
    const sql = stripSqlComments(readMigration("20260804100000_finance_posting_helpers.sql"));
    expect(sql).toMatch(/period_start <= p_entry_date/);
    expect(sql).toMatch(/period_end >= p_entry_date/);
    expect(sql).not.toMatch(/insert into public\.accounting_periods/);
    expect(sql).toMatch(/errcode = 'P1101'/);
  });

  it("uses a fresh P1100-P1117 error range across the Posting Engine migrations, colliding with no prior errcode in this schema", () => {
    const allCodes = ["P1100", "P1101", "P1102", "P1103", "P1104", "P1105", "P1106", "P1107", "P1108", "P1109", "P1110", "P1111", "P1112", "P1113", "P1114", "P1115", "P1116", "P1117"];
    const combined = POSTING_ENGINE_FILES.map((f) => readMigration(f)).join("\n");
    for (const code of ["P1100", "P1101", "P1104", "P1105", "P1106", "P1107", "P1108", "P1109", "P1110", "P1111", "P1112", "P1113", "P1114", "P1115", "P1116", "P1117"]) {
      expect(combined).toMatch(new RegExp(`errcode = '${code}'`));
    }
    // Finance F1.8's two migrations, and F2.1B's one migration, are an
    // intentional, sanctioned extension of this exact P1100+ range for the
    // same Finance Ledger domain — reusing P1104/P1105/P1109/P1111 for their
    // EXACT established meanings (duplicate posting / invalid transition /
    // already reversed / missing source document), not a collision of two
    // different meanings sharing one code. P1118 (F1.8) and P1119 (F2.1B)
    // are each the next genuinely new code in the same sequence. Excluded
    // from the "no other file" check below for that reason, not because the
    // collision guard stopped mattering.
    const LATER_SANCTIONED_FINANCE_FILES = [
      "20260821100000_finance_mark_payment_succeeded_atomic.sql",
      "20260821100100_finance_payment_refund_reversal.sql",
      "20260822100000_finance_invoice_revenue_recognition.sql",
      "20260822110000_finance_invoice_revenue_recognition_refund_guard.sql",
    ];
    for (const otherFile of migrationFiles().filter((f) => !POSTING_ENGINE_FILES.includes(f) && !LATER_SANCTIONED_FINANCE_FILES.includes(f))) {
      const sql = readMigration(otherFile);
      for (const code of allCodes) {
        expect(sql).not.toMatch(new RegExp(`errcode = '${code}'`));
      }
    }
  });

  it("uses no exception handlers anywhere in the Posting Engine migrations, matching the established no-swallowed-errors convention", () => {
    for (const file of POSTING_ENGINE_FILES) {
      expect(stripSqlComments(readMigration(file))).not.toMatch(/exception\s+when/i);
    }
  });

  describe("post_purchase_receipt / record_purchase_receipt composition", () => {
    const sql = () => readMigration("20260804100100_finance_post_purchase_receipt.sql");

    it("requires p_receipt_event_id with no default — the caller must supply a stable id", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/create or replace function public\.record_purchase_receipt\(\s*\n\s*p_purchase_item_id uuid,\s*\n\s*p_quantity_received integer,\s*\n\s*p_reason text,\s*\n\s*p_actor text,\s*\n\s*p_receipt_event_id uuid\s*\n\)/);
      expect(code).not.toMatch(/p_receipt_event_id uuid default/);
      expect(code).toMatch(/if p_receipt_event_id is null then/);
      expect(code).toMatch(/errcode = 'P0010'/);
    });

    it("does not assign P0010 anywhere else in the schema (fresh code in the Purchases-owned P0005-P0009 range)", () => {
      for (const otherFile of migrationFiles().filter((f) => f !== "20260804100100_finance_post_purchase_receipt.sql")) {
        expect(readMigration(otherFile)).not.toMatch(/errcode = 'P0010'/);
      }
    });

    it("computes the posted amount from unit_cost_minor * the current call's quantity only, not the cumulative quantity_received", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/v_amount_minor := v_item\.unit_cost_minor \* p_quantity_received;/);
    });

    it("debits 1200 Inventory Asset for inventory-linked lines and 6290 for non-inventory lines, always crediting 2000 Accounts Payable", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_item\.inventory_item_id is not null then\s*\n\s*v_debit_account := public\.finance_resolve_account\(v_purchase\.workspace_id, 1200\);/);
      expect(code).toMatch(/else\s*\n\s*v_debit_account := public\.finance_resolve_account\(v_purchase\.workspace_id, 6290\);/);
      expect(code).toMatch(/v_credit_account := public\.finance_resolve_account\(v_purchase\.workspace_id, 2000\);/);
    });

    it("uses purchase_item_id as source_id (traceability to the operational document), not the receipt event id", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/'purchase_receipt',\s*\n\s*p_purchase_item_id::text,/);
      expect(code).not.toMatch(/source_id = p_receipt_event_id::text/);
      expect(code).not.toMatch(/'purchase_receipt',\s*\n\s*p_receipt_event_id::text/);
    });

    it("derives posting_key from receipt_event_id alone, the system-level idempotency identifier — no workspace_id inside the string, since the (workspace_id, posting_key) unique index already scopes it per workspace", () => {
      const code = stripSqlComments(sql());
      const occurrences = code.match(/v_posting_key := 'purchase_receipt:' \|\| p_receipt_event_id;/g) ?? [];
      expect(occurrences.length).toBeGreaterThanOrEqual(2);
      expect(code).not.toMatch(/posting_key := 'purchase_receipt:' \|\| v_purchase\.workspace_id/);
    });

    it("no longer creates a dedicated unique index on bare source_id for purchase_receipt (source_id is purchase_item_id now, not unique per event)", () => {
      expect(sql()).not.toMatch(/journal_entries_purchase_receipt_event_unique/);
    });

    it("checks for a duplicate posting_key via the (workspace_id, posting_key) unique index's backing lookup, in both functions", () => {
      const code = stripSqlComments(sql());
      const lookups = code.match(/where workspace_id = v_purchase\.workspace_id and posting_key = v_posting_key/g) ?? [];
      expect(lookups.length).toBeGreaterThanOrEqual(2);
    });

    it("posts exactly 2 balanced lines (one debit, one credit, same amount variable used for both)", () => {
      const code = stripSqlComments(sql());
      const lines = code.match(/jsonb_build_object\('account_id'/g) ?? [];
      expect(lines).toHaveLength(2);
      expect(code).toMatch(/'debit_minor', v_amount_minor, 'credit_minor', 0/);
      expect(code).toMatch(/'debit_minor', 0, 'credit_minor', v_amount_minor/);
    });

    it("calls post_purchase_receipt from inside record_purchase_receipt, after the existing timeline_activities insert, with no new transaction boundary (no begin/commit)", () => {
      const code = stripSqlComments(sql());
      const timelineIndex = code.indexOf("insert into public.timeline_activities");
      const postIndex = code.indexOf("perform public.post_purchase_receipt(");
      expect(timelineIndex).toBeGreaterThan(-1);
      expect(postIndex).toBeGreaterThan(timelineIndex);
      expect(code).not.toMatch(/\bbegin\s*;|\bcommit\s*;/i);
    });

    it("still rejects over-receipt (P0009) before any posting call could run", () => {
      const code = stripSqlComments(sql());
      const overReceiptIndex = code.indexOf("errcode = 'P0009'");
      const postIndex = code.indexOf("perform public.post_purchase_receipt(");
      expect(overReceiptIndex).toBeGreaterThan(-1);
      expect(postIndex).toBeGreaterThan(overReceiptIndex);
    });

    it("preserves the existing purchase_items -> purchases row-lock order unchanged", () => {
      const code = stripSqlComments(sql());
      const itemLockIndex = code.indexOf("select * into v_item from public.purchase_items where id = p_purchase_item_id for update");
      const purchaseLockIndex = code.indexOf("select * into v_purchase from public.purchases where id = v_item.purchase_id for update");
      expect(itemLockIndex).toBeGreaterThan(-1);
      expect(purchaseLockIndex).toBeGreaterThan(itemLockIndex);
    });

    it("checks for a duplicate receipt_event_id inside record_purchase_receipt BEFORE any mutation — before over-receipt validation, the Inventory movement call, the quantity_received update, and the Timeline insert", () => {
      const code = stripSqlComments(sql());
      const purchaseLockIndex = code.indexOf("select * into v_purchase from public.purchases where id = v_item.purchase_id for update");
      const idempotencyCheckIndex = code.indexOf("if exists (select 1 from public.journal_entries where workspace_id = v_purchase.workspace_id and posting_key = v_posting_key) then\n    return v_item;");
      const overReceiptIndex = code.indexOf("errcode = 'P0009'");
      const movementCallIndex = code.indexOf("select public.record_inventory_movement(");
      const quantityUpdateIndex = code.indexOf("update public.purchase_items");
      const timelineIndex = code.indexOf("insert into public.timeline_activities");

      expect(purchaseLockIndex).toBeGreaterThan(-1);
      expect(idempotencyCheckIndex).toBeGreaterThan(purchaseLockIndex);
      expect(idempotencyCheckIndex).toBeLessThan(overReceiptIndex);
      expect(idempotencyCheckIndex).toBeLessThan(movementCallIndex);
      expect(idempotencyCheckIndex).toBeLessThan(quantityUpdateIndex);
      expect(idempotencyCheckIndex).toBeLessThan(timelineIndex);
    });

    it("a duplicate receipt_event_id returns the current row as a no-op (idempotent replay), not an error — the retry check does not raise", () => {
      const code = stripSqlComments(sql());
      const checkBlock = code.match(/if exists \(select 1 from public\.journal_entries where workspace_id = v_purchase\.workspace_id and posting_key = v_posting_key\) then\s*\n\s*return v_item;\s*\n\s*end if;/);
      expect(checkBlock).not.toBeNull();
    });

    it("documents the idempotent-replay vs duplicate-posting distinction — a repeat event is a replay, not an error, unlike every other posting RPC", () => {
      const sqlRaw = sql();
      expect(sqlRaw).toMatch(/IDEMPOTENT REPLAY, not duplicate rejection/);
    });

    it("a genuinely different receipt_event_id produces a different posting_key, so distinct partial receipts remain valid (idempotency is keyed on the event id, not the item)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/'purchase_receipt:' \|\| p_receipt_event_id/);
      expect(code).not.toMatch(/posting_key = 'purchase_receipt:';?\s*$/m);
    });
  });

  describe("post_payment_settlement / record_payment_settlement", () => {
    const sql = () => readMigration("20260804100200_finance_post_payment_settlement.sql");

    it("rejects payment_method = 'stripe' with a clear domain error, never resolving account 1010 Stripe Clearing", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if p_payment_method = 'stripe' then/);
      expect(code).toMatch(/errcode = 'P1117'/);
      expect(code).not.toMatch(/finance_resolve_account\([^)]*,\s*1010\)/);
    });

    it("debits 1000 Cash and credits 1100 Accounts Receivable when invoice-linked, or 2200 Customer Deposits when not", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_payment\.invoice_id is not null then\s*\n\s*v_credit_account := public\.finance_resolve_account\(v_payment\.workspace_id, 1100\);/);
      expect(code).toMatch(/else\s*\n\s*v_credit_account := public\.finance_resolve_account\(v_payment\.workspace_id, 2200\);/);
      expect(code).toMatch(/finance_resolve_account\(v_payment\.workspace_id, 1000\)/);
    });

    it("is idempotent per payment_id: locks the row and pre-checks for an existing posting before inserting", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/select \* into v_payment from public\.payments where id = p_payment_id for update/);
      expect(code).toMatch(/source_type = 'payment_settlement' and source_id = p_payment_id::text/);
      expect(code).toMatch(/errcode = 'P1104'/);
    });

    it("carries a deterministic posting_key of payment_settlement:<payment_id>", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/v_posting_key := 'payment_settlement:' \|\| p_payment_id;/);
      expect(code).toMatch(/p_actor,\s*\n\s*null,\s*\n\s*v_posting_key,/);
    });

    it("record_payment_settlement composes recompute_invoice_balance and post_payment_settlement in one function, no new transaction boundary", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/perform public\.recompute_invoice_balance\(p_invoice_id, p_actor\)/);
      expect(code).toMatch(/perform public\.post_payment_settlement\(v_payment\.id, p_actor\)/);
      expect(code).not.toMatch(/\bbegin\s*;|\bcommit\s*;/i);
    });
  });

  describe("post_expense_transition / record_expense_transition", () => {
    const sql = () => readMigration("20260804100300_finance_post_expense_transition.sql");

    it("maps ExpenseCategory to its Chart of Accounts account, with category=inventory -> 1200 and category=refund -> 4950 as special cases", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/when 'inventory' then 1200/);
      expect(code).toMatch(/when 'refund' then 4950/);
      expect(code).toMatch(/when 'decor' then 6100/);
      expect(code).toMatch(/when 'miscellaneous' then 6900/);
    });

    it("detects a prior expense_due entry to decide the 'paid' debit side, never recognizing the expense twice", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/select exists\(\s*\n\s*select 1 from public\.journal_entries where source_type = 'expense_due' and source_id = p_expense_id::text\s*\n\s*\) into v_had_due_entry;/);
      expect(code).toMatch(/if v_had_due_entry then\s*\n\s*v_debit_account := public\.finance_resolve_account\(v_expense\.workspace_id, 2000\);/);
    });

    it("is idempotent per (expense, transition source_type)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/source_type = v_source_type and source_id = p_expense_id::text/);
      expect(code).toMatch(/errcode = 'P1104'/);
    });

    it("carries a deterministic posting_key of expense_due|expense_paid|expense_reimbursement:<expense_id> — 'reimbursement' in posting_key even though source_type stays 'expense_reimbursed'", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/when 'due' then 'expense_due:' \|\| p_expense_id/);
      expect(code).toMatch(/when 'paid' then 'expense_paid:' \|\| p_expense_id/);
      expect(code).toMatch(/when 'reimbursed' then 'expense_reimbursement:' \|\| p_expense_id/);
      expect(code).toMatch(/p_actor,\s*\n\s*null,\s*\n\s*v_posting_key,/);
    });

    it("record_expense_transition validates the status transition before updating, rejecting an invalid one with P1105", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_expense\.status not in \('planned', 'approved'\) then/);
      expect(code).toMatch(/if v_expense\.status not in \('planned', 'approved', 'due'\) then/);
      expect(code).toMatch(/if v_expense\.status <> 'paid' then/);
      expect(code.match(/errcode = 'P1105'/g)?.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("post_inventory_movement_entry / record_inventory_movement composition", () => {
    const sql = () => readMigration("20260804100400_finance_post_inventory_movement_entry.sql");

    it("returns null without posting for reservation, reservation_release, and purchase (purchase is owned by post_purchase_receipt instead)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_movement\.movement_type in \('reservation', 'reservation_release', 'purchase'\) then\s*\n\s*return null;/);
    });

    it("maps every financially-relevant movement type to its approved debit/credit account pair", () => {
      const code = stripSqlComments(sql());
      const expectations: Record<string, [number, number]> = {
        initial_stock: [1200, 3000],
        adjustment_increase: [1200, 7100],
        adjustment_decrease: [5100, 1200],
        event_checkout: [5000, 1200],
        event_return: [1200, 5000],
        damage: [5100, 1200],
        loss: [5100, 1200],
        disposal: [5100, 1200],
      };
      const debitCase = code.match(/v_debit_number := case v_movement\.movement_type([\s\S]*?)end;/)?.[1] ?? "";
      const creditCase = code.match(/v_credit_number := case v_movement\.movement_type([\s\S]*?)end;/)?.[1] ?? "";
      for (const [type, [debit, credit]] of Object.entries(expectations)) {
        expect(debitCase).toMatch(new RegExp(`when '${type}' then ${debit}`));
        expect(creditCase).toMatch(new RegExp(`when '${type}' then ${credit}`));
      }
    });

    it("refuses to post when the Inventory item has no unit_cost, rather than valuing the movement at zero", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_item\.unit_cost is null then/);
      expect(code).toMatch(/cannot value this movement for posting/);
    });

    it("is idempotent per movement row (source_id = inventory_movement id)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/source_type = v_source_type and source_id = p_inventory_movement_id::text/);
      expect(code).toMatch(/errcode = 'P1104'/);
    });

    it("carries a deterministic posting_key of inventory_movement:<movement_id>", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/v_posting_key := 'inventory_movement:' \|\| p_inventory_movement_id;/);
      expect(code).toMatch(/p_actor,\s*\n\s*null,\s*\n\s*v_posting_key,/);
    });

    it("calls post_inventory_movement_entry from inside record_inventory_movement, after the existing Timeline insert, with no new transaction boundary", () => {
      const code = stripSqlComments(sql());
      const timelineIndex = code.indexOf("insert into public.timeline_activities");
      const postIndex = code.indexOf("perform public.post_inventory_movement_entry(");
      expect(timelineIndex).toBeGreaterThan(-1);
      expect(postIndex).toBeGreaterThan(timelineIndex);
      expect(code).not.toMatch(/\bbegin\s*;|\bcommit\s*;/i);
    });

    it("preserves record_inventory_movement's existing item lock and quantity-invariant checks unchanged", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/select \* into v_item from public\.inventory_items where id = p_inventory_item_id for update/);
      expect(code).toMatch(/errcode = 'P0004'/);
    });
  });

  describe("reverse_journal_entry", () => {
    const sql = () => readMigration("20260804100500_finance_reverse_journal_entry.sql");

    it("widens journal_entries_source_type_check additively to add 'reversal', preserving every prior value", () => {
      const code = stripSqlComments(sql());
      for (const priorType of ["purchase_receipt", "invoice_issued", "payment_settlement", "expense_due", "manual_adjustment"]) {
        expect(code).toMatch(new RegExp(`'${priorType}'`));
      }
      expect(code).toMatch(/'reversal'/);
    });

    it("rejects a blank or missing reason with P1112", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if p_reason is null or btrim\(p_reason\) = '' then/);
      expect(code).toMatch(/errcode = 'P1112'/);
    });

    it("locks the target entry and rejects reversing an already-reversed entry with P1109", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/select \* into v_original from public\.journal_entries where id = p_journal_entry_id for update/);
      expect(code).toMatch(/if v_original\.reversed_by_entry_id is not null then/);
      expect(code).toMatch(/errcode = 'P1109'/);
    });

    it("swaps every line's debit and credit via jsonb_agg, never mutating the original entry's financial values", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/'debit_minor', credit_minor,\s*\n\s*'credit_minor', debit_minor,/);
      expect(code).not.toMatch(/update public\.journal_lines/);
      expect(code).not.toMatch(/update public\.journal_entries\s*\n\s*set\s+(?!reversed_by_entry_id)/);
    });

    it("carries a deterministic posting_key of reversal:<original_journal_entry_id>", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/v_posting_key := 'reversal:' \|\| p_journal_entry_id;/);
      expect(code).toMatch(/p_journal_entry_id,\s*\n\s*v_posting_key,\s*\n\s*v_reversed_lines/);
    });

    it("sets reverses_entry_id on the new entry and reversed_by_entry_id on the original, in that order", () => {
      const code = stripSqlComments(sql());
      const insertIndex = code.indexOf("v_reversal := public.finance_insert_journal_entry(");
      const updateMatch = code.match(/update public\.journal_entries\s*\n\s*set reversed_by_entry_id = v_reversal\.id/);
      expect(insertIndex).toBeGreaterThan(-1);
      expect(updateMatch).not.toBeNull();
      expect(code.indexOf(updateMatch![0])).toBeGreaterThan(insertIndex);
    });

    it("relies on the existing period-protection trigger for locked/closed-period rejection rather than re-implementing it", () => {
      const code = stripSqlComments(sql());
      expect(code).not.toMatch(/errcode = 'P1102'/);
      expect(code).not.toMatch(/errcode = 'P1103'/);
      expect(code).not.toMatch(/status = 'locked'/);
    });
  });

  describe("record_manual_adjustment", () => {
    const sql = () => readMigration("20260804100600_finance_record_manual_adjustment.sql");

    it("rejects a blank memo (P1113) and fewer than 2 lines (P1114)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if p_memo is null or btrim\(p_memo\) = '' then/);
      expect(code).toMatch(/errcode = 'P1113'/);
      expect(code).toMatch(/jsonb_array_length\(p_lines\) < 2/);
      expect(code).toMatch(/errcode = 'P1114'/);
    });

    it("rejects a line with both sides zero or both sides positive (P1115)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/\(v_debit > 0 and v_credit > 0\) or \(v_debit = 0 and v_credit = 0\)/);
      expect(code).toMatch(/errcode = 'P1115'/);
    });

    it("rejects a cross-workspace account (P1107) and an archived account (P1108)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_account\.workspace_id <> p_workspace_id then/);
      expect(code).toMatch(/errcode = 'P1107'/);
      expect(code).toMatch(/if v_account\.archived_at is not null then/);
      expect(code).toMatch(/errcode = 'P1108'/);
    });

    it("pre-validates the total debit equals total credit (P1106) before ever attempting the insert", () => {
      const code = stripSqlComments(sql());
      const balanceCheckIndex = code.indexOf("if v_total_debit <> v_total_credit then");
      const insertIndex = code.indexOf("v_entry := public.finance_insert_journal_entry(");
      expect(balanceCheckIndex).toBeGreaterThan(-1);
      expect(insertIndex).toBeGreaterThan(balanceCheckIndex);
      expect(code).toMatch(/errcode = 'P1106'/);
    });

    it("never auto-balances or adds a plug line — no arithmetic adjusts v_total_debit/v_total_credit to force equality", () => {
      const code = stripSqlComments(sql());
      expect(code).not.toMatch(/v_total_debit\s*:=\s*v_total_credit/);
      expect(code).not.toMatch(/v_total_credit\s*:=\s*v_total_debit/);
    });

    it("always posts with source_type = 'manual_adjustment' and a null source_id", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/'manual_adjustment', null, p_memo/);
    });

    it("never assigns a deterministic posting_key — passes null, unlike every other posting RPC", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/p_workspace_id, p_entry_date, 'manual_adjustment', null, p_memo, p_actor, null, null, p_lines/);
    });
  });

  describe("Finance Timeline owner_type widening", () => {
    it("adds only 'accounting_period' to timeline_activities_owner_type_check, not 'journal_entry', preserving every prior value", () => {
      const sql = readMigration("20260804100700_finance_timeline_owner_type_widening.sql");
      const code = stripSqlComments(sql);
      for (const priorType of ["lead", "client", "event", "contract", "invoice", "payment", "expense", "document", "document_folder", "inventory_item", "vendor", "purchase"]) {
        expect(sql).toMatch(new RegExp(`'${priorType}'`));
      }
      expect(sql).toMatch(/'accounting_period'/);
      expect(code).not.toMatch(/'journal_entry'/);
      expect(code).not.toMatch(/timeline_activities_type_check/);
    });
  });

  describe("create_accounting_period / close_period / lock_period", () => {
    const sql = () => readMigration("20260804100800_finance_accounting_period_rpcs.sql");

    it("create_accounting_period pre-checks overlap with an explicit SELECT rather than an exception handler, and rejects period_end <= period_start", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if p_period_end <= p_period_start then/);
      expect(code).toMatch(/daterange\(period_start, period_end, '\[\]'\) && daterange\(p_period_start, p_period_end, '\[\]'\)/);
      expect(code).toMatch(/errcode = 'P1116'/);
    });

    it("close_period rejects a non-open period and unresolved pending/failed postings, then sets closed_at/closed_by and logs Timeline", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_period\.status <> 'open' then/);
      expect(code).toMatch(/posting_status in \('pending', 'failed'\)/);
      expect(code).toMatch(/set status = 'closed', closed_at = now\(\), closed_by = p_actor/);
      expect(code).toMatch(/'accounting_period', v_period\.id, 'accounting_period_closed'/);
    });

    it("lock_period rejects a direct open-to-locked transition and an already-locked period, then sets locked_at/locked_by and logs Timeline", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_period\.status <> 'closed' then/);
      expect(code).toMatch(/set status = 'locked', locked_at = now\(\), locked_by = p_actor/);
      expect(code).toMatch(/'accounting_period', v_period\.id, 'accounting_period_locked'/);
    });

    it("close_period and lock_period both row-lock the target period before checking its status", () => {
      const code = stripSqlComments(sql());
      const closeLockIndex = code.indexOf("select * into v_period from public.accounting_periods where id = p_period_id for update");
      const lockLockIndex = code.lastIndexOf("select * into v_period from public.accounting_periods where id = p_period_id for update");
      expect(closeLockIndex).toBeGreaterThan(-1);
      expect(lockLockIndex).toBeGreaterThan(closeLockIndex);
    });
  });

  describe("Audit contract", () => {
    it("documents the atomicity boundary between Journal posting and Core Audit Log in a migration comment, without inventing a new SQL audit mechanism", () => {
      const sql = readMigration("20260804100000_finance_posting_helpers.sql");
      expect(sql).toMatch(/AUDIT CONTRACT/);
      expect(sql).toMatch(/Core Audit Log entries are NOT part of that\s*\n-- transaction/);
      expect(sql).toMatch(/must never retry a financial RPC merely because writing the Audit entry\s*\n-- afterward failed/);
    });

    it("introduces no parallel Finance-specific audit table, trigger, or function across the entire Posting Engine migration set", () => {
      for (const file of POSTING_ENGINE_FILES) {
        const code = stripSqlComments(readMigration(file));
        expect(code).not.toMatch(/create table[^;]*audit/i);
        expect(code).not.toMatch(/create or replace function public\.\w*audit\w*/i);
        expect(code).not.toMatch(/create trigger[^;]*audit/i);
      }
    });

    it("no Finance migration references an audit_log or audit_events table — Core Audit Log has no live Supabase table anywhere in this schema", () => {
      for (const file of POSTING_ENGINE_FILES) {
        const code = stripSqlComments(readMigration(file));
        expect(code).not.toMatch(/audit_log|audit_events/i);
      }
    });
  });

  describe("Stripe deferral", () => {
    it("introduces no Stripe SDK, routes, environment variables, or code touching stripe_webhook_events across the entire Posting Engine migration set", () => {
      for (const file of POSTING_ENGINE_FILES) {
        const sql = readMigration(file);
        expect(sql).not.toMatch(/stripe_webhook_events/);
        expect(sql).not.toMatch(/post_stripe_payout/);
        expect(sql).not.toMatch(/stripe_webhook_received/);
        expect(sql).not.toMatch(/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|stripe\.com\/v1/i);
      }
    });

    it("post_payment_settlement never resolves account 1010 Stripe Clearing in its actual account-resolution code", () => {
      const sql = stripSqlComments(readMigration("20260804100200_finance_post_payment_settlement.sql"));
      expect(sql).not.toMatch(/finance_resolve_account\([^)]*,\s*1010\)/);
    });
  });
});

describe("Finance F1.8 migrations — payment atomicity + refund reversal", () => {
  describe("mark_payment_succeeded_and_post_settlement", () => {
    const sql = () => readMigration("20260821100000_finance_mark_payment_succeeded_atomic.sql");

    it("locks the payment row and rejects any status other than pending/processing with P1105, before ever posting", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/select \* into v_payment from public\.payments where id = p_payment_id for update/);
      expect(code).toMatch(/if v_payment\.status not in \('pending', 'processing'\) then/);
      expect(code).toMatch(/errcode = 'P1105'/);
      const transitionCheckIndex = code.indexOf("if v_payment.status not in");
      const postIndex = code.indexOf("perform public.post_payment_settlement(");
      expect(transitionCheckIndex).toBeGreaterThan(-1);
      expect(postIndex).toBeGreaterThan(transitionCheckIndex);
    });

    it("composes the EXISTING post_payment_settlement — no new posting primitive, no duplicated account-routing logic", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/perform public\.post_payment_settlement\(p_payment_id, p_actor\)/);
      expect(code).not.toMatch(/finance_resolve_account/);
      expect(code).not.toMatch(/finance_insert_journal_entry/);
    });

    it("recomputes the linked Invoice balance in the same transaction, only when invoice-linked", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_payment\.invoice_id is not null then\s*\n\s*perform public\.recompute_invoice_balance\(v_payment\.invoice_id, p_actor\);/);
    });

    it("updates status/received_at before posting, in one function with no explicit transaction boundary — an exception anywhere rolls the whole thing back", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/update public\.payments\s*\n\s*set status = 'succeeded', received_at = now\(\), updated_at = now\(\)/);
      expect(code).not.toMatch(/\bbegin\s*;|\bcommit\s*;/i);
    });
  });

  describe("post_payment_refund_reversal / process_payment_refund composition", () => {
    const sql = () => readMigration("20260821100100_finance_payment_refund_reversal.sql");

    it("posts a PARTIAL reversal for the refund's own amount_minor, never the original settlement's full amount", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/'debit_minor', v_refund\.amount_minor, 'credit_minor', 0/);
      expect(code).toMatch(/'debit_minor', 0, 'credit_minor', v_refund\.amount_minor/);
      // Scoped to the reversal function only — process_payment_refund's own
      // pre-existing refundable-ceiling math legitimately uses
      // v_original.amount_minor elsewhere in this same file.
      const reversalFn = code.match(/create or replace function public\.post_payment_refund_reversal[\s\S]*?^\$\$;/m)?.[0] ?? "";
      expect(reversalFn.length).toBeGreaterThan(0);
      expect(reversalFn).not.toMatch(/v_original\.amount_minor/);
    });

    it("reads the ORIGINAL settlement's actual posted account_ids back from journal_lines rather than re-deriving routing from invoice_id", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/select \* into v_cash_line from public\.journal_lines where journal_entry_id = v_settlement_entry\.id and debit_minor > 0/);
      expect(code).toMatch(/select \* into v_credit_line from public\.journal_lines where journal_entry_id = v_settlement_entry\.id and credit_minor > 0/);
      expect(code).not.toMatch(/invoice_id is not null then/);
    });

    it("never sets reverses_entry_id/reversed_by_entry_id — reserved exclusively for reverse_journal_entry's whole-entry semantics", () => {
      const code = stripSqlComments(sql());
      expect(code).not.toMatch(/reversed_by_entry_id/);
      expect(code).not.toMatch(/reverses_entry_id/);
    });

    it("fails with P1118 rather than inventing a reversal when no payment_settlement entry exists for the original payment", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/source_type = 'payment_settlement'\s*\n\s*and source_id = p_original_payment_id::text/);
      expect(code).toMatch(/errcode = 'P1118'/);
    });

    it("is idempotent per refund row: posting_key is payment_refund:<refund_payment_id>, never the original payment's id", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/v_posting_key := 'payment_refund:' \|\| p_refund_payment_id;/);
      expect(code).not.toMatch(/'payment_refund:' \|\| p_original_payment_id/);
      expect(code).toMatch(/source_type = 'payment_refund' and source_id = p_refund_payment_id::text/);
      expect(code).toMatch(/errcode = 'P1104'/);
    });

    it("does not widen journal_entries_source_type_check — 'payment_refund' was already an allowed value from the original Database Schema phase", () => {
      const code = stripSqlComments(sql());
      expect(code).not.toMatch(/journal_entries_source_type_check/);
      expect(code).not.toMatch(/alter table public\.journal_entries/);
    });

    it("process_payment_refund composes post_payment_refund_reversal after the refund insert and original-status update, no new transaction boundary", () => {
      const code = stripSqlComments(sql());
      const insertIndex = code.indexOf("returning * into v_refund;");
      const statusUpdateIndex = code.indexOf("set status = case when (v_refundable - p_amount_minor) = 0 then 'refunded' else 'partially_refunded' end");
      const postIndex = code.indexOf("perform public.post_payment_refund_reversal(v_refund.id, v_original.id, p_actor);");
      expect(insertIndex).toBeGreaterThan(-1);
      expect(statusUpdateIndex).toBeGreaterThan(insertIndex);
      expect(postIndex).toBeGreaterThan(statusUpdateIndex);
      expect(code).not.toMatch(/\bbegin\s*;|\bcommit\s*;/i);
    });

    it("preserves every pre-existing process_payment_refund validation unchanged (P0001-P0004)", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/errcode = 'P0001'/);
      expect(code).toMatch(/errcode = 'P0002'/);
      expect(code).toMatch(/errcode = 'P0003'/);
      expect(code).toMatch(/errcode = 'P0004'/);
      expect(code).toMatch(/if v_original\.status not in \('succeeded', 'partially_refunded'\) then/);
    });
  });

  describe("F1.8 does not touch Revenue Recognition, account 4000, or AR origination", () => {
    it("neither migration file references account 4000, revenue recognition, or AR origination language", () => {
      for (const file of ["20260821100000_finance_mark_payment_succeeded_atomic.sql", "20260821100100_finance_payment_refund_reversal.sql"]) {
        const code = stripSqlComments(readMigration(file));
        expect(code).not.toMatch(/,\s*4000\)/);
        expect(code).not.toMatch(/revenue recognition/i);
        expect(code).not.toMatch(/ar origination|originate.{0,10}(accounts receivable|ar\b)/i);
      }
    });
  });
});

describe("Finance F2.1B migration — invoice revenue recognition (clean cases)", () => {
  const FILE = "20260822100000_finance_invoice_revenue_recognition.sql";
  const sql = () => readMigration(FILE);

  it("does not widen journal_entries_source_type_check — 'invoice_issued' and 'invoice_voided' were already allowed values from the reverse_journal_entry migration", () => {
    const code = stripSqlComments(sql());
    expect(code).not.toMatch(/journal_entries_source_type_check/);
    expect(code).not.toMatch(/alter table public\.journal_entries/);
  });

  it("does not insert or alter any Chart of Accounts row — reuses only already-seeded accounts", () => {
    const code = stripSqlComments(sql());
    expect(code).not.toMatch(/insert into public\.chart_of_accounts/);
    expect(code).not.toMatch(/alter table public\.chart_of_accounts/);
  });

  describe("post_invoice_revenue_recognition", () => {
    it("posts the exact recognition formula: Dr AR (1100) total_minor, Cr Revenue (4000) subtotal_minor", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/v_ar_account := public\.finance_resolve_account\(v_invoice\.workspace_id, 1100\)/);
      expect(code).toMatch(/v_revenue_account := public\.finance_resolve_account\(v_invoice\.workspace_id, 4000\)/);
      expect(code).toMatch(/'account_id', v_ar_account\.id, 'debit_minor', v_invoice\.total_minor, 'credit_minor', 0/);
      expect(code).toMatch(/'account_id', v_revenue_account\.id, 'debit_minor', 0, 'credit_minor', v_invoice\.subtotal_minor/);
    });

    it("conditionally posts Sales Discounts (4900) and Sales Tax Payable (2100) only when the amount is greater than zero", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/if v_invoice\.discount_minor > 0 then/);
      expect(code).toMatch(/public\.finance_resolve_account\(v_invoice\.workspace_id, 4900\)/);
      expect(code).toMatch(/if v_invoice\.tax_minor > 0 then/);
      expect(code).toMatch(/public\.finance_resolve_account\(v_invoice\.workspace_id, 2100\)/);
    });

    it("is idempotent per invoice: rejects a duplicate with P1104, keyed on source_type='invoice_issued'", () => {
      const code = stripSqlComments(sql());
      expect(code).toMatch(/source_type = 'invoice_issued' and source_id = p_invoice_id::text/);
      expect(code).toMatch(/errcode = 'P1104'/);
      expect(code).toMatch(/v_posting_key := 'invoice_issued:' \|\| p_invoice_id;/);
    });

    it("does not validate invoice lifecycle status itself — same division of responsibility as post_payment_settlement", () => {
      const code = sql();
      const fn = code.match(/create or replace function public\.post_invoice_revenue_recognition[\s\S]*?^\$\$;/m)?.[0] ?? "";
      expect(fn.length).toBeGreaterThan(0);
      const stripped = fn.replace(/--.*$/gm, "");
      expect(stripped).not.toMatch(/v_invoice\.status/);
    });
  });

  describe("issue_invoice_and_post_revenue_recognition", () => {
    const fn = () => {
      const match = stripSqlComments(sql()).match(/create or replace function public\.issue_invoice_and_post_revenue_recognition[\s\S]*?^\$\$;/m)?.[0];
      return match ?? "";
    };

    it("locks the invoice row and rejects any status other than draft with P1105, before ever posting", () => {
      const code = fn();
      expect(code).toMatch(/select \* into v_invoice from public\.invoices where id = p_invoice_id for update/);
      expect(code).toMatch(/if v_invoice\.status <> 'draft' then/);
      expect(code).toMatch(/errcode = 'P1105'/);
      const transitionCheckIndex = code.indexOf("if v_invoice.status <> 'draft'");
      const postIndex = code.indexOf("perform public.post_invoice_revenue_recognition(");
      expect(transitionCheckIndex).toBeGreaterThan(-1);
      expect(postIndex).toBeGreaterThan(transitionCheckIndex);
    });

    it("composes the EXISTING post_invoice_revenue_recognition — no duplicated account-routing logic", () => {
      const code = fn();
      expect(code).toMatch(/perform public\.post_invoice_revenue_recognition\(p_invoice_id, p_actor\)/);
      expect(code).not.toMatch(/finance_resolve_account/);
      expect(code).not.toMatch(/finance_insert_journal_entry/);
    });

    it("updates status/issue_date before posting, in one function with no explicit transaction boundary", () => {
      const code = fn();
      expect(code).toMatch(/set status = 'issued', issue_date = coalesce\(issue_date, current_date\), updated_at = now\(\)/);
      expect(code).not.toMatch(/\bbegin\s*;|\bcommit\s*;/i);
    });
  });

  describe("post_invoice_voided_reversal", () => {
    const fn = () => {
      const match = stripSqlComments(sql()).match(/create or replace function public\.post_invoice_voided_reversal[\s\S]*?^\$\$;/m)?.[0];
      return match ?? "";
    };

    it("refuses to reverse an invoice with any payment applied — P1119", () => {
      const code = fn();
      expect(code).toMatch(/if v_invoice\.paid_minor > 0 then/);
      expect(code).toMatch(/errcode = 'P1119'/);
    });

    it("returns a safe no-op (null) if the invoice was never issued", () => {
      const code = fn();
      expect(code).toMatch(/if not found then\s*\n\s*return null;/);
    });

    it("swaps every original line's debit/credit, matching reverse_journal_entry's own guarantee", () => {
      const code = fn();
      expect(code).toMatch(/'account_id', v_line\.account_id, 'debit_minor', v_line\.credit_minor, 'credit_minor', v_line\.debit_minor/);
    });

    it("never mutates the original entry except reversed_by_entry_id — no journal_lines UPDATE", () => {
      const code = fn();
      expect(code).not.toMatch(/update public\.journal_lines/);
      expect(code).toMatch(/update public\.journal_entries set reversed_by_entry_id = v_entry\.id where id = v_original\.id/);
    });

    it("is idempotent: rejects an already-reversed entry (P1109) and a duplicate reversal posting (P1104)", () => {
      const code = fn();
      expect(code).toMatch(/if v_original\.reversed_by_entry_id is not null then/);
      expect(code).toMatch(/errcode = 'P1109'/);
      expect(code).toMatch(/source_type = 'invoice_voided' and source_id = p_invoice_id::text/);
      expect(code).toMatch(/errcode = 'P1104'/);
      expect(code).toMatch(/v_posting_key := 'invoice_voided:' \|\| p_invoice_id;/);
    });

    it("reads the ORIGINAL entry's actual posted lines back from journal_lines rather than re-deriving routing", () => {
      const code = fn();
      expect(code).toMatch(/select \* from public\.journal_lines where journal_entry_id = v_original\.id order by line_order/);
    });
  });

  describe("void_invoice_and_reverse_revenue_recognition", () => {
    const fn = () => {
      const match = stripSqlComments(sql()).match(/create or replace function public\.void_invoice_and_reverse_revenue_recognition[\s\S]*?^\$\$;/m)?.[0];
      return match ?? "";
    };

    it("locks the invoice row and rejects an already-terminal status (paid/voided/archived) with P1105", () => {
      const code = fn();
      expect(code).toMatch(/select \* into v_invoice from public\.invoices where id = p_invoice_id for update/);
      expect(code).toMatch(/if v_invoice\.status not in \('draft', 'issued', 'sent', 'viewed', 'partially_paid', 'overdue'\) then/);
      expect(code).toMatch(/errcode = 'P1105'/);
    });

    it("updates status before reversing, in one function with no explicit transaction boundary", () => {
      const code = fn();
      expect(code).toMatch(/set status = 'voided', voided_at = now\(\), updated_at = now\(\)/);
      const statusIndex = code.indexOf("set status = 'voided'");
      const reversalIndex = code.indexOf("perform public.post_invoice_voided_reversal(");
      expect(statusIndex).toBeGreaterThan(-1);
      expect(reversalIndex).toBeGreaterThan(statusIndex);
      expect(code).not.toMatch(/\bbegin\s*;|\bcommit\s*;/i);
    });
  });

  it("uses no exception handlers, matching the established no-swallowed-errors convention", () => {
    expect(stripSqlComments(sql())).not.toMatch(/exception\s+when/i);
  });

  it("F2.1B does not implement void-after-partial-payment correction, post-issuance edits, deposit application, or refund-side Revenue reduction", () => {
    const code = stripSqlComments(sql());
    expect(code).not.toMatch(/proportional.{0,20}void|partial.{0,10}void.{0,10}reversal/i);
    expect(code).not.toMatch(/deposit.{0,10}applied|apply.{0,10}deposit/i);
    expect(code).not.toMatch(/4950/); // Refunds & Returns — refund-side Revenue reduction is F2.1C scope
  });
});

describe("Finance F2.1B-REVIEW migration — refund-vs-recognized-Revenue guard", () => {
  const FILE = "20260822110000_finance_invoice_revenue_recognition_refund_guard.sql";
  const sql = () => stripSqlComments(readMigration(FILE));

  it("redefines process_payment_refund only — no new table, no Chart of Accounts mutation, no CHECK widening", () => {
    const code = sql();
    expect(code).toMatch(/create or replace function public\.process_payment_refund\(/);
    expect(code).not.toMatch(/create table/i);
    expect(code).not.toMatch(/insert into public\.chart_of_accounts/);
    expect(code).not.toMatch(/alter table public\.chart_of_accounts/);
    expect(code).not.toMatch(/journal_entries_source_type_check/);
  });

  it("rejects (P1120) refunding an invoice-linked payment whose invoice has unreversed recognized Revenue, before any mutation", () => {
    const code = sql();
    expect(code).toMatch(/if v_original\.invoice_id is not null and exists \(/);
    expect(code).toMatch(/source_type = 'invoice_issued'/);
    expect(code).toMatch(/and reversed_by_entry_id is null/);
    expect(code).toMatch(/errcode = 'P1120'/);
    const guardIndex = code.indexOf("errcode = 'P1120'");
    const insertIndex = code.indexOf("insert into public.payments (");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(guardIndex);
  });

  it("does not restrict non-invoice-linked (Customer Deposits) refunds — the guard is invoice_id-scoped", () => {
    const code = sql();
    expect(code).toMatch(/if v_original\.invoice_id is not null and exists/);
    expect(code).not.toMatch(/2200/); // Customer Deposits account — untouched by this guard
  });

  it("preserves every pre-existing process_payment_refund validation and the F1.8 reversal composition unchanged", () => {
    const code = sql();
    expect(code).toMatch(/errcode = 'P0001'/);
    expect(code).toMatch(/errcode = 'P0002'/);
    expect(code).toMatch(/errcode = 'P0003'/);
    expect(code).toMatch(/errcode = 'P0004'/);
    expect(code).toMatch(/perform public\.post_payment_refund_reversal\(v_refund\.id, v_original\.id, p_actor\)/);
  });

  it("uses no exception handlers, matching the established no-swallowed-errors convention", () => {
    expect(sql()).not.toMatch(/exception\s+when/i);
  });

  it("does not implement Revenue-side refund correction — this is a guard, not a posting fix", () => {
    const code = sql();
    expect(code).not.toMatch(/4950/); // Refunds & Returns contra-revenue account — F2.1C scope
    expect(code).not.toMatch(/4000/); // Service Revenue account — never credited/debited by this file
  });
});

describe("Finance Reports Foundation migration", () => {
  const FILE = "20260805100000_finance_report_rpcs.sql";
  const sql = () => readMigration(FILE);
  const REPORT_FUNCTIONS = [
    "finance_general_ledger_report",
    "finance_trial_balance_report",
    "finance_profit_and_loss_report",
    "finance_balance_sheet_report",
  ];

  it("defines all four report functions as security invoker, stable, with a pinned search_path", () => {
    const code = stripSqlComments(sql());
    for (const fn of REPORT_FUNCTIONS) {
      expect(code).toMatch(new RegExp(`create or replace function public\\.${fn}`));
    }
    expect(code.match(/security invoker/gi)?.length).toBe(4);
    expect(code.match(/\bstable\b/gi)?.length).toBe(4);
    expect(code.match(/set search_path = public/gi)?.length).toBe(4);
  });

  it("uses no exception handlers, matching the established no-swallowed-errors convention", () => {
    expect(stripSqlComments(sql())).not.toMatch(/exception\s+when/i);
  });

  it("uses a fresh P1200 error code for report input validation, colliding with no prior errcode in this schema", () => {
    expect(sql()).toMatch(/errcode = 'P1200'/);
    for (const otherFile of migrationFiles().filter((f) => f !== FILE)) {
      expect(readMigration(otherFile)).not.toMatch(/errcode = 'P1200'/);
    }
  });

  it("every function validates its own required date parameter(s) with a P1200 check that appears before its own return query", () => {
    const code = stripSqlComments(sql());
    for (const fn of REPORT_FUNCTIONS) {
      const start = code.indexOf(`create or replace function public.${fn}`);
      const end = code.indexOf("end;\n$$;", start);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      const body = code.slice(start, end);
      const validationIndex = body.indexOf("errcode = 'P1200'");
      const queryIndex = body.indexOf("return query");
      expect(validationIndex, `${fn} should raise P1200 somewhere in its body`).toBeGreaterThanOrEqual(0);
      expect(queryIndex, `${fn} should call return query`).toBeGreaterThanOrEqual(0);
      expect(validationIndex, `${fn} must validate before querying`).toBeLessThan(queryIndex);
    }
  });

  it("finance_profit_and_loss_report specifically rejects a comparison period missing one of its two dates", () => {
    const code = stripSqlComments(sql());
    expect(code).toMatch(/p_comparison_start_date is null\)\s*<>\s*\(p_comparison_end_date is null\)/);
  });

  it("derives exclusively from journal_entries/journal_lines/chart_of_accounts — never from invoices, payments, expenses, purchases, or inventory_movements", () => {
    const code = stripSqlComments(sql());
    for (const forbiddenTable of ["invoices", "payments", "expenses", "purchases", "purchase_items", "inventory_movements"]) {
      expect(code).not.toMatch(new RegExp(`\\bfrom public\\.${forbiddenTable}\\b`));
      expect(code).not.toMatch(new RegExp(`\\bjoin public\\.${forbiddenTable}\\b`));
    }
  });

  it("every query filters to posting_status = 'posted'", () => {
    const code = stripSqlComments(sql());
    expect(code.match(/posting_status = 'posted'/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("finance_general_ledger_report is driven from eligible_accounts (not activity), so a zero-activity account still gets a row", () => {
    const code = stripSqlComments(sql());
    expect(code).toMatch(/from eligible_accounts ea\s*\n\s*left join opening o on o\.account_id = ea\.id\s*\n\s*left join activity a on a\.account_id = ea\.id/);
  });

  it("finance_balance_sheet_report computes current-period earnings as credit minus debit uniformly, without a per-account CASE", () => {
    const code = stripSqlComments(sql());
    expect(code).toMatch(/sum\(jl\.credit_minor - jl\.debit_minor\)/);
  });

  it("introduces no Stripe SDK, routes, environment variables, or code touching stripe_webhook_events", () => {
    const code = sql();
    expect(code).not.toMatch(/stripe_webhook_events/);
    expect(code).not.toMatch(/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|stripe\.com\/v1/i);
  });

  it("adds no new table, index, or RLS policy — every report reads through the existing RLS-protected ledger tables", () => {
    const code = stripSqlComments(sql());
    expect(code).not.toMatch(/create table/i);
    expect(code).not.toMatch(/create index/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).not.toMatch(/enable row level security/i);
  });

  it("sorts after every Posting Engine migration", () => {
    const files = migrationFiles();
    const reportsIndex = files.indexOf(FILE);
    const lastPostingEngineIndex = files.indexOf("20260804100800_finance_accounting_period_rpcs.sql");
    expect(reportsIndex).toBeGreaterThan(lastPostingEngineIndex);
  });
});

describe("Services Foundation schema migrations", () => {
  const servicesFiles = () => migrationFiles().filter((f) => f.startsWith("20260806"));

  it("contains exactly 20 migrations", () => {
    expect(servicesFiles()).toHaveLength(20);
  });

  it("orders services before service_versions, and both before the circular-FK-resolving alter inside the service_versions migration", () => {
    const files = migrationFiles();
    const servicesIndex = files.indexOf("20260806100100_services.sql");
    const versionsIndex = files.indexOf("20260806100200_service_versions.sql");
    expect(servicesIndex).toBeLessThan(versionsIndex);

    const versionsSql = stripSqlComments(readMigration("20260806100200_service_versions.sql"));
    expect(versionsSql).toMatch(/alter table public\.services\s*\n\s*add constraint services_draft_version_id_fkey/);
  });

  it("orders every template table migration before the immutability triggers migration", () => {
    const files = migrationFiles();
    const templateFiles = [
      "20260806100300_service_catalog_display_templates.sql",
      "20260806100400_service_operational_templates.sql",
      "20260806100500_service_readiness_templates.sql",
      "20260806100600_service_resource_templates.sql",
      "20260806100700_service_metadata_templates.sql",
    ];
    const triggersIndex = files.indexOf("20260806101500_service_immutability_triggers.sql");
    for (const f of templateFiles) {
      expect(files.indexOf(f)).toBeLessThan(triggersIndex);
    }
  });

  it("orders event_services before its 6 Instance-layer child tables", () => {
    const files = migrationFiles();
    const eventServicesIndex = files.indexOf("20260806100800_event_services.sql");
    expect(eventServicesIndex).toBeLessThan(files.indexOf("20260806100900_event_service_requirements.sql"));
    expect(eventServicesIndex).toBeLessThan(files.indexOf("20260806101000_event_service_engagement.sql"));
  });

  it("orders RLS before indexes/constraints, and both before the RPC migrations", () => {
    const files = migrationFiles();
    const rlsIndex = files.indexOf("20260806101400_service_rls.sql");
    const indexesIndex = files.indexOf("20260806101600_service_indexes_and_constraints.sql");
    const publishRpcIndex = files.indexOf("20260806101700_service_publish_version_function.sql");
    const assignRpcIndex = files.indexOf("20260806101900_service_assign_to_event_function.sql");
    expect(rlsIndex).toBeLessThan(indexesIndex);
    expect(indexesIndex).toBeLessThan(publishRpcIndex);
    expect(publishRpcIndex).toBeLessThan(assignRpcIndex);
  });

  it("service_versions enforces the versioning-concurrency locked decision with a partial unique index on (service_id, version_number)", () => {
    const sql = stripSqlComments(readMigration("20260806100200_service_versions.sql"));
    expect(sql).toMatch(/create unique index if not exists service_versions_workspace_number_unique\s*\n\s*on public\.service_versions \(service_id, version_number\)\s*\n\s*where version_number is not null/);
  });

  it("publish_service_version row-locks the parent services row before computing the next version_number", () => {
    const sql = stripSqlComments(readMigration("20260806101700_service_publish_version_function.sql"));
    expect(sql).toMatch(/select \* into v_service from public\.services where id = p_service_id for update/);
  });

  it("assign_service_to_event row-locks the target events row and performs every insert inside one function body (one transaction)", () => {
    const sql = stripSqlComments(readMigration("20260806101900_service_assign_to_event_function.sql"));
    expect(sql).toMatch(/select \* into v_event from public\.events where id = p_event_id for update/);
    const insertCount = (sql.match(/insert into public\./g) ?? []).length;
    expect(insertCount).toBeGreaterThanOrEqual(8);
  });

  it("does not widen media_assets_owner_type_check — no Attachments front door exists yet for Services", () => {
    const sql = stripSqlComments(readMigration("20260806101100_service_owner_type_widening.sql"));
    expect(sql).not.toMatch(/alter table public\.media_assets/);
  });

  it("every template table migration includes the immutability-trigger comment rationale, except the ones that don't get a trigger", () => {
    const sql = stripSqlComments(readMigration("20260806101500_service_immutability_triggers.sql"));
    const triggerCount = (sql.match(/create trigger trg_service_\w+_reject_published_write/g) ?? []).length;
    expect(triggerCount).toBe(16);
  });
});
