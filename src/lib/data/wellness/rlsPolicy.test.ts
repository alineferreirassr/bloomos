import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A live Postgres instance isn't available in this environment (no
 * SUPABASE_DB_URL/service-role credentials in this checkout), so this is a
 * static guard on the deployed policy TEXT rather than a live RLS
 * execution test — it reads the actual migration file and asserts the
 * exact clauses that make the privacy guarantee real. If someone later
 * edits the migration to add a Founder/Admin exception to the wellness
 * tables, weakens the active-membership requirement, or adds an
 * UPDATE/DELETE policy to notes_to_founder, this test fails immediately,
 * catching the regression before it ships — this is the primary defense
 * against exactly those mistakes. It proves the SQL *says* the right
 * thing, not that it *behaves* the right thing against a live database.
 *
 * Substring assertions are used deliberately instead of regex capture
 * groups — the policy clauses themselves contain parentheses
 * (`auth.uid()`), which breaks naive `[^)]+`-style captures.
 */
const migrationSql = readFileSync(join(process.cwd(), "supabase/migrations/20260902100000_employee_wellness_privacy.sql"), "utf-8");

function policyBlock(policyName: string, endMarker: string): string {
  const start = migrationSql.indexOf(`create policy "${policyName}"`);
  expect(start).toBeGreaterThan(-1);
  const end = migrationSql.indexOf(endMarker, start);
  expect(end).toBeGreaterThan(start);
  return migrationSql.slice(start, end);
}

describe("employee_wellness_checkins / employee_water_logs RLS — self-only, active-membership-only, no founder/admin exception", () => {
  it("wellness_checkins_self_only policy requires member_id = auth.uid() AND is_workspace_member(workspace_id), no OR clause, no role reference", () => {
    const block = policyBlock("wellness_checkins_self_only", "create policy \"water_logs_self_only\"");
    expect(block).toContain("using (member_id = auth.uid() and public.is_workspace_member(workspace_id))");
    expect(block).toContain("with check (member_id = auth.uid() and public.is_workspace_member(workspace_id))");
    expect(block).not.toMatch(/\bor\b/i);
    expect(block).not.toMatch(/has_workspace_role|owner|admin/i);
  });

  it("water_logs_self_only policy requires member_id = auth.uid() AND is_workspace_member(workspace_id), no OR clause, no role reference", () => {
    const block = policyBlock("water_logs_self_only", "create trigger trg_employee_wellness_checkins_set_updated_at");
    expect(block).toContain("using (member_id = auth.uid() and public.is_workspace_member(workspace_id))");
    expect(block).toContain("with check (member_id = auth.uid() and public.is_workspace_member(workspace_id))");
    expect(block).not.toMatch(/\bor\b/i);
    expect(block).not.toMatch(/has_workspace_role|owner|admin/i);
  });

  it("both tables enable row level security", () => {
    expect(migrationSql).toContain("alter table public.employee_wellness_checkins enable row level security;");
    expect(migrationSql).toContain("alter table public.employee_water_logs enable row level security;");
  });

  it("both policies are FOR ALL — a removed member also immediately loses insert/update/delete on their own past rows, not just select", () => {
    expect(migrationSql).toMatch(/create policy "wellness_checkins_self_only"\s+on public\.employee_wellness_checkins for all/);
    expect(migrationSql).toMatch(/create policy "water_logs_self_only"\s+on public\.employee_water_logs for all/);
  });
});

describe("notes_to_founder RLS — author or founder/admin read, permanently append-only", () => {
  it("select policy grants author_id = auth.uid() OR has_workspace_role(owner/admin)", () => {
    const block = policyBlock("notes_to_founder_select_author_or_founder", "create policy \"notes_to_founder_insert_author\"");
    expect(block).toContain("author_id = auth.uid() or public.has_workspace_role(workspace_id, array['owner', 'admin'])");
  });

  it("insert policy only allows the author to create their own note", () => {
    const block = policyBlock("notes_to_founder_insert_author", "with check (author_id = auth.uid());");
    expect(block).toContain("insert");
    expect(migrationSql).toContain('create policy "notes_to_founder_insert_author"');
    const insertBlock = migrationSql.slice(migrationSql.indexOf('create policy "notes_to_founder_insert_author"'));
    expect(insertBlock).toContain("with check (author_id = auth.uid());");
    expect(insertBlock).not.toContain("has_workspace_role");
  });

  it("table has no mood/water columns — nothing to auto-attach", () => {
    const tableBlock = migrationSql.slice(migrationSql.indexOf("create table if not exists public.notes_to_founder"), migrationSql.indexOf("comment on table public.notes_to_founder"));
    expect(tableBlock).not.toMatch(/mood|glasses|water/i);
  });

  it("has exactly two policies (select, insert) — no update or delete policy exists, by product decision", () => {
    const policyMatches = migrationSql.match(/create policy "notes_to_founder_[a-z_]+"/g) ?? [];
    expect(policyMatches.sort()).toEqual(['create policy "notes_to_founder_insert_author"', 'create policy "notes_to_founder_select_author_or_founder"']);
    expect(migrationSql).not.toMatch(/create policy "notes_to_founder_[a-z_]*update[a-z_]*"/i);
    expect(migrationSql).not.toMatch(/create policy "notes_to_founder_[a-z_]*delete[a-z_]*"/i);
    expect(migrationSql).not.toMatch(/on public\.notes_to_founder for (update|delete)/i);
  });

  it("the migration documents the append-only decision explicitly, not silently", () => {
    expect(migrationSql).toMatch(/append-only/i);
    expect(migrationSql).toMatch(/no update or delete policy/i);
  });
});
