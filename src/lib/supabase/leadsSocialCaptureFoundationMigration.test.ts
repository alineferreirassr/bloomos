import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function readMigration(filename: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
}

/** Same technique as leadsMigrations.test.ts's own stripSqlComments — structural checks can't false-positive on prose that merely mentions SQL syntax. */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("SOCIAL-13C-FND leads social capture foundation migration", () => {
  const sql = readMigration("20260928100000_leads_social_capture_foundation.sql");
  const code = stripSqlComments(sql);

  it("drops NOT NULL from email, first_name, and last_name on leads — never touches clients", () => {
    expect(code).toMatch(/alter table public\.leads[\s\S]*?alter column email drop not null/i);
    expect(code).toMatch(/alter column first_name drop not null/i);
    expect(code).toMatch(/alter column last_name drop not null/i);
    expect(code).not.toMatch(/alter table public\.clients/i);
  });

  it("adds a nullable instagram_external_id column to leads, distinct from the existing instagram column", () => {
    expect(code).toMatch(/add column instagram_external_id text/i);
  });

  it("creates a partial unique index scoped to (workspace_id, instagram_external_id), never a bare/global unique constraint", () => {
    expect(code).toMatch(
      /create unique index leads_workspace_instagram_external_id_idx\s*\n\s*on public\.leads \(workspace_id, instagram_external_id\)\s*\n\s*where instagram_external_id is not null/i,
    );
  });

  it("never creates a plain (non-partial, non-workspace-scoped) unique index or constraint on instagram_external_id alone", () => {
    expect(code).not.toMatch(/unique\s*\(\s*instagram_external_id\s*\)/i);
    expect(code).not.toMatch(/add constraint.*instagram_external_id.*unique/i);
  });

  it("replaces convert_lead_to_client with a version that rejects a null-name Lead before a null-email Lead, both as clean P0001 business errors", () => {
    expect(code).toMatch(/create or replace function public\.convert_lead_to_client/i);
    const nameGuardIndex = code.search(/if v_lead\.first_name is null or v_lead\.last_name is null then/i);
    const emailGuardIndex = code.search(/if v_lead\.email is null then/i);
    expect(nameGuardIndex).toBeGreaterThan(-1);
    expect(emailGuardIndex).toBeGreaterThan(-1);
    expect(nameGuardIndex).toBeLessThan(emailGuardIndex);
    expect(code).toMatch(/'A name is required before this lead can be converted to a Client\.' using errcode = 'P0001'/);
    expect(code).toMatch(/'A valid email is required before this lead can be converted to a Client\.' using errcode = 'P0001'/);
  });

  it("preserves the existing dedup-by-email-match and duplicate-conversion/archived rejections from the prior version of the function, unchanged", () => {
    expect(code).toMatch(/'Lead not found\.' using errcode = 'P0001'/);
    expect(code).toMatch(/'Archived leads cannot be converted to a Client\.' using errcode = 'P0001'/);
    expect(code).toMatch(/'This lead has already been converted to a Client\.' using errcode = 'P0001'/);
    expect(code).toMatch(/lower\(trim\(email\)\) = lower\(trim\(v_lead\.email\)\)/i);
  });

  it("keeps security invoker — RLS still governs every statement inside the function, matching every other Supabase write in this codebase", () => {
    expect(code).toMatch(/security invoker/i);
    expect(code).not.toMatch(/security definer/i);
  });

  it("never touches any table outside leads/clients/timeline_activities (no automation, webhook, social, or finance table referenced)", () => {
    for (const forbidden of ["automation_", "meta_webhook_events", "instagram_comments", "instagram_conversations", "instagram_messages", "integration_connections", "integration_credentials", "invoices", "payments"]) {
      expect(code.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
