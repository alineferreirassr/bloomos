import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
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
  it("contains exactly the 8 Supabase Foundation + 5 Leads + 6 Clients + 8 Events + 6 Media Library + 8 Contracts + 8 Finance + 8 Documents + 1 Phase 1 cleanup + 11 Team foundation + 1 Team foundation fix + 8 Client Accounts + Invitations foundation + 5 Client Portal MVP + 3 SECURITY DEFINER privilege-hardening + 3 Booking Workflow + 1 Clients Core-integration + 7 Inventory + 5 Vendors + 1 Inventory movement-recording function + 7 Purchases + 1 Purchases receiving function + 11 Finance Ledger Database migrations, in chronological (execution) order", () => {
    const files = migrationFiles();
    expect(files).toHaveLength(122);
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
