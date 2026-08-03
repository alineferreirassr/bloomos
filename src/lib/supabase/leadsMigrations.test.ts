import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

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

describe("leads migration", () => {
  const sql = readMigration("20260716100000_leads.sql");

  it("creates the leads table scoped to a Workspace with a uuid primary key", () => {
    expect(sql).toMatch(/create table if not exists public\.leads/i);
    expect(sql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i);
    expect(sql).toMatch(/workspace_id uuid not null references public\.workspaces \(id\) on delete cascade/i);
  });

  it("declares every column from src\/types\/lead.ts", () => {
    for (const column of [
      "first_name",
      "last_name",
      "email",
      "phone",
      "instagram",
      "source",
      "event_type",
      "event_date",
      "location",
      "budget_min",
      "budget_max",
      "message",
      "status",
      "assigned_to",
      "converted_client_id",
      "created_at",
      "updated_at",
      "archived_at",
    ]) {
      expect(sql).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("constrains status to the 9 canonical lead lifecycle values", () => {
    expect(sql).toMatch(
      /status in \(\s*'new', 'contacted', 'welcome_guide_sent', 'consultation_scheduled',\s*'qualified', 'proposal_sent', 'converted', 'lost', 'archived'\s*\)/,
    );
  });

  it("has no delete policy target and relies on soft delete (archived_at column present, no physical delete helper)", () => {
    expect(sql).toMatch(/archived_at timestamptz/i);
    expect(stripSqlComments(sql)).not.toMatch(/drop table/i);
  });

  it("indexes workspace_id for RLS/filter performance", () => {
    expect(sql).toMatch(/create index.*leads_workspace_id_idx.*on public\.leads \(workspace_id\)/i);
  });
});

describe("notes migration (Leads-scoped)", () => {
  const sql = readMigration("20260716100100_notes.sql");

  it("creates a polymorphic notes table with owner_type constrained to lead only", () => {
    expect(sql).toMatch(/create table if not exists public\.notes/i);
    expect(sql).toMatch(/owner_type text not null/i);
    expect(sql).toMatch(/constraint notes_owner_type_check check \(owner_type in \('lead'\)\)/i);
  });

  it("declares owner_id as uuid with no foreign key (polymorphic ownership)", () => {
    expect(sql).toMatch(/owner_id uuid not null/i);
    expect(sql).not.toMatch(/owner_id uuid not null references/i);
  });

  it("constrains category and priority to the canonical enum values", () => {
    expect(sql).toMatch(/'general', 'special_request', 'preference', 'relationship_detail'/);
    expect(sql).toMatch(/priority in \('low', 'normal', 'high', 'critical'\)/);
  });

  it("indexes the workspace_id + owner_type + owner_id composite used by every query", () => {
    expect(sql).toMatch(/create index.*notes_workspace_owner_idx.*on public\.notes \(workspace_id, owner_type, owner_id\)/i);
  });
});

describe("timeline_activities migration (Leads-scoped)", () => {
  const sql = readMigration("20260716100200_timeline_activities.sql");

  it("creates a polymorphic, append-only timeline_activities table with owner_type constrained to lead only", () => {
    expect(sql).toMatch(/create table if not exists public\.timeline_activities/i);
    expect(sql).toMatch(/constraint timeline_activities_owner_type_check check \(owner_type in \('lead'\)\)/i);
  });

  it("has no updated_at column — every entry is immutable once written", () => {
    expect(stripSqlComments(sql)).not.toMatch(/updated_at/i);
  });

  it("constrains type to only the activity types the Leads Supabase repository actually writes (no lead_converted — conversion stays mock-only)", () => {
    expect(sql).toMatch(/'lead_created', 'lead_updated', 'status_changed', 'note_added'/);
    expect(sql).toMatch(/'note_pinned', 'note_unpinned', 'welcome_guide_sent', 'lead_archived'/);
    expect(stripSqlComments(sql)).not.toMatch(/'lead_converted'/);
  });
});

describe("leads updated_at triggers migration", () => {
  const sql = readMigration("20260716100300_leads_updated_at_triggers.sql");

  it("attaches the shared set_updated_at() trigger to leads and notes, but not timeline_activities", () => {
    expect(sql).toMatch(/create trigger trg_leads_set_updated_at\s*\n\s*before update on public\.leads/i);
    expect(sql).toMatch(/create trigger trg_notes_set_updated_at\s*\n\s*before update on public\.notes/i);
    expect(stripSqlComments(sql)).not.toMatch(/timeline_activities/i);
  });

  it("does not redefine set_updated_at() — reuses the Supabase Foundation's function", () => {
    expect(sql).not.toMatch(/create (or replace )?function public\.set_updated_at/i);
  });
});

describe("leads RLS migration", () => {
  const sql = readMigration("20260716100400_leads_rls.sql");

  it("enables row level security on all three tables", () => {
    expect(sql).toMatch(/alter table public\.leads enable row level security/i);
    expect(sql).toMatch(/alter table public\.notes enable row level security/i);
    expect(sql).toMatch(/alter table public\.timeline_activities enable row level security/i);
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

  it("gates every policy on is_workspace_member(workspace_id) — Workspace isolation only, no role gating", () => {
    const policyBlocks = sql.split(/create policy/i).slice(1);
    for (const block of policyBlocks) {
      expect(block).toMatch(/is_workspace_member\(workspace_id\)/);
    }
    expect(sql).not.toMatch(/has_workspace_role/);
  });

  it("has select/insert/update policies for leads and notes, but only select/insert for timeline_activities (immutable, append-only)", () => {
    expect(sql).toMatch(/create policy "leads_select_workspace_member"/);
    expect(sql).toMatch(/create policy "leads_insert_workspace_member"/);
    expect(sql).toMatch(/create policy "leads_update_workspace_member"/);
    expect(sql).toMatch(/create policy "notes_select_workspace_member"/);
    expect(sql).toMatch(/create policy "notes_insert_workspace_member"/);
    expect(sql).toMatch(/create policy "notes_update_workspace_member"/);
    expect(sql).toMatch(/create policy "timeline_activities_select_workspace_member"/);
    expect(sql).toMatch(/create policy "timeline_activities_insert_workspace_member"/);
    expect(sql).not.toMatch(/create policy "timeline_activities_update/);
  });

  it("has no delete policy on any of the three tables — nothing is ever physically deleted", () => {
    expect(sql).not.toMatch(/for delete/i);
  });
});
