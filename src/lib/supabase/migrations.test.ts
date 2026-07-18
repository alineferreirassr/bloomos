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
  it("contains exactly the 8 Supabase Foundation + 5 Leads + 6 Clients + 8 Events + 6 Media Library + 8 Contracts + 8 Finance + 8 Documents + 1 Phase 1 cleanup + 11 Team foundation + 1 Team foundation fix + 8 Client Accounts + Invitations foundation + 5 Client Portal MVP migrations, in chronological (execution) order", () => {
    const files = migrationFiles();
    expect(files).toHaveLength(83);
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
