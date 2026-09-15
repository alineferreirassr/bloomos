import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getDataMode } from "@/lib/env";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapLeadRow } from "@/lib/supabase/mappers";
import { readLeads, writeLeads } from "@/lib/data/mock/leadsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import type { Lead, InstagramLeadCaptureInput } from "@/types/lead";
import type { Database } from "@/types/database.types";

/**
 * SOCIAL-13C — the write side of Instagram Lead capture: find-or-create a
 * Lead keyed on `(workspace_id, instagram_external_id)`, the partial
 * unique index SOCIAL-13C-FND added specifically for this. A new,
 * deliberately narrow module (mirroring `instagramCommentReplyServiceRole.ts`/
 * `instagramDirectMessageServiceRole.ts`'s own precedent of "one small file
 * per concern, never shared"), but unlike those two, this one is not
 * scoped to a single data mode — Automation Engine dispatch (and its own
 * tests) can run under either `mock` or `supabase`
 * (`NEXT_PUBLIC_DATA_MODE`), so both branches live here, selected the same
 * way `lib/data/provider.ts`'s `selectRepository()` does everywhere else,
 * without pulling this system/webhook-context capability into the
 * `LeadsRepository` interface itself — that interface is deliberately the
 * *human form* contract (`leadFormSchema`-gated `createLead`), untouched by
 * SOCIAL-13C-FND on purpose, and this is a genuinely different contract
 * (system-originated, nullable identity fields, no session).
 *
 * Duplicate handling is two-layered, exactly as authorized: (1) a
 * lookup-before-insert for the common case, (2) the unique index itself as
 * the final authority for the concurrent-race case — mirroring SOCIAL-11D's
 * own `instagram_comments`/`instagram_conversations` "lookup-then-create,
 * with a duplicate-result backstop" idiom exactly, never a
 * check-then-act-only race. A duplicate is never an error: this function
 * returns `{ created: false }` with the *existing*, untouched Lead —
 * nothing about an existing Lead (name, email, status, instagram) is ever
 * overwritten by a repeat capture.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";
const UNIQUE_VIOLATION_CODE = "23505";

export interface FindOrCreateInstagramLeadResult {
  lead: Lead;
  /** `false` for both the common case (already existed) and the concurrent-race case (someone else's insert won) — the caller never needs to distinguish the two; neither one creates a duplicate or touches the existing row. */
  created: boolean;
}

/** Lazy, never module-scoped — mirrors every other narrow service-role boundary's own "re-read on every access, never throw at import time" discipline. */
function createServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function newLeadFields(input: InstagramLeadCaptureInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: null,
    instagram: input.instagram,
    instagram_external_id: input.instagramExternalId,
    source: input.source,
    event_type: null,
    event_date: null,
    location: null,
    budget_min: null,
    budget_max: null,
    message: input.message,
    status: "new" as const,
    assigned_to: null,
    converted_client_id: null,
  };
}

async function findOrCreateInstagramLeadMock(input: InstagramLeadCaptureInput): Promise<DataResult<FindOrCreateInstagramLeadResult>> {
  const existing = readLeads().find((lead) => lead.workspace_id === input.workspaceId && lead.instagram_external_id === input.instagramExternalId);
  if (existing) return ok({ lead: existing, created: false });

  const timestamp = nowIso();
  const lead: Lead = {
    id: generateId("lead"),
    workspace_id: input.workspaceId,
    ...newLeadFields(input),
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeLeads([...readLeads(), lead]);
  recordTimelineActivity(lead.workspace_id, "lead", lead.id, "lead_created", "Lead created from an Instagram comment/DM");

  return ok({ lead, created: true });
}

async function insertTimelineActivity(supabase: SupabaseClient<Database>, workspaceId: string, ownerId: string): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: "lead",
    owner_id: ownerId,
    type: "lead_created",
    description: "Lead created from an Instagram comment/DM",
    actor: "Instagram automation",
  });
  // A failed timeline write is logged nowhere here on purpose: the Lead
  // itself is already durably created by this point, and — mirroring
  // metaWebhookProcessing.ts's own "was this event ingested" vs. "did the
  // automation itself succeed" separation — a missing history entry is
  // never worth failing (or duplicating) a real, already-persisted Lead.
  if (error) throw normalizeSupabaseError(error);
}

async function findOrCreateInstagramLeadSupabase(input: InstagramLeadCaptureInput): Promise<DataResult<FindOrCreateInstagramLeadResult>> {
  const supabase = createServiceRoleClient();
  if (!supabase) return fail("Service unavailable.");

  const { data: existingRow, error: selectError } = await supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("instagram_external_id", input.instagramExternalId)
    .maybeSingle();
  if (selectError) throw normalizeSupabaseError(selectError);
  if (existingRow) return ok({ lead: mapLeadRow(existingRow), created: false });

  const { data: insertedRow, error: insertError } = await supabase
    .from("leads")
    .insert({ workspace_id: input.workspaceId, ...newLeadFields(input) })
    .select("*")
    .single();

  if (insertError) {
    if ((insertError as { code?: string }).code === UNIQUE_VIOLATION_CODE) {
      // Concurrent capture of the same Instagram identity — the unique
      // index (workspace_id, instagram_external_id) is the real authority
      // here, not this function's own earlier SELECT. Re-read the winning
      // row rather than raising; never retry the insert.
      const { data: raceRow, error: raceError } = await supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .eq("instagram_external_id", input.instagramExternalId)
        .maybeSingle();
      if (raceError) throw normalizeSupabaseError(raceError);
      if (raceRow) return ok({ lead: mapLeadRow(raceRow), created: false });
    }
    throw normalizeSupabaseError(insertError);
  }

  const lead = mapLeadRow(insertedRow);
  await insertTimelineActivity(supabase, lead.workspace_id, lead.id);

  return ok({ lead, created: true });
}

/**
 * Finds an existing Instagram-originated Lead in this workspace, or
 * creates one. Never overwrites an existing Lead's own fields (name,
 * email, status, instagram, message) — a repeat capture of the same
 * external identity is always a pure no-op read, never an update.
 */
export async function findOrCreateInstagramLead(input: InstagramLeadCaptureInput): Promise<DataResult<FindOrCreateInstagramLeadResult>> {
  return getDataMode() === "supabase" ? findOrCreateInstagramLeadSupabase(input) : findOrCreateInstagramLeadMock(input);
}
