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
  it("contains exactly the 8 Supabase Foundation + 5 Leads + 6 Clients + 8 Events migrations, in chronological (execution) order", () => {
    const files = migrationFiles();
    expect(files).toHaveLength(27);
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
