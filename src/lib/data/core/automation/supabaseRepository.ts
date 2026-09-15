import type { AutomationExecution, RecordAutomationExecutionInput } from "@/types/automation";
import type { AutomationRepository } from "@/lib/data/core/automation/repository";
import type { Database } from "@/types/database.types";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapAutomationExecutionRow } from "@/lib/supabase/mappers";

/**
 * SOCIAL-11B — the Supabase-backed sibling of
 * `mockRepository.ts`, implementing the same `AutomationRepository`
 * interface `core/automation/manager.ts` already depends on — not a second
 * Automation Engine, not a second execution system. Uses the ordinary
 * session-bound client (never a service-role one): `automation_executions`/
 * `automation_approval_overrides` both have real `authenticated` RLS
 * policies (see the migration's own PERMISSION_DECISION reasoning), the
 * same "workspace_id is trusted only because RLS re-derives it" boundary
 * every other repository in this codebase already relies on.
 */

type SupabaseClient = ReturnType<typeof createSupabaseClient>;
type ApprovalOverrideRow = Database["public"]["Tables"]["automation_approval_overrides"]["Row"];

const NOT_FOUND_ERROR = "Automation execution not found.";
const NOT_PENDING_APPROVE_ERROR = "Only a pending execution can be approved.";
const NOT_PENDING_REJECT_ERROR = "Only a pending execution can be rejected.";

async function fetchExecutionRow(supabase: SupabaseClient, id: string): Promise<AutomationExecution | null> {
  const { data, error } = await supabase.from("automation_executions").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapAutomationExecutionRow(data) : null;
}

async function recordExecution(workspaceId: string, input: RecordAutomationExecutionInput): Promise<DataResult<AutomationExecution>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("automation_executions")
    .insert({
      workspace_id: workspaceId,
      automation_id: input.automationId,
      automation_name: input.automationName,
      automation_version: input.automationVersion,
      trigger_type: input.trigger,
      trigger_facts: input.triggerFacts,
      conditions_passed: input.conditionsPassed,
      approval_status: input.approvalStatus,
      approved_by: input.approvedBy,
      approved_at: input.approvedAt,
      action_results: input.actionResults as unknown as Database["public"]["Tables"]["automation_executions"]["Insert"]["action_results"],
      status: input.status,
      duration_ms: input.durationMs,
      started_at: input.startedAt,
      completed_at: input.completedAt,
      started_by: input.startedBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw normalizeSupabaseError(error);
  return ok(mapAutomationExecutionRow(data));
}

async function getRecentExecutions(workspaceId: string, limit: number): Promise<AutomationExecution[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("automation_executions").select("*").eq("workspace_id", workspaceId).order("started_at", { ascending: false }).limit(limit);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapAutomationExecutionRow);
}

async function getExecutionById(id: string): Promise<AutomationExecution | null> {
  const supabase = createSupabaseClient();
  return fetchExecutionRow(supabase, id);
}

async function getPendingApprovals(workspaceId: string): Promise<AutomationExecution[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("automation_executions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("approval_status", "pending")
    .order("started_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapAutomationExecutionRow);
}

/** Faithfully preserves mockRepository.ts's own behavior: only ever updates approval_status/approved_by/approved_at — never `status` itself. */
async function approveExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>> {
  const supabase = createSupabaseClient();
  const existing = await fetchExecutionRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.approvalStatus !== "pending") return fail(NOT_PENDING_APPROVE_ERROR);

  const { data, error } = await supabase
    .from("automation_executions")
    .update({ approval_status: "approved", approved_by: approverId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapAutomationExecutionRow(data));
}

/** Faithfully preserves mockRepository.ts's own behavior: this is the one path that also sets status='rejected' and completed_at. */
async function rejectExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>> {
  const supabase = createSupabaseClient();
  const existing = await fetchExecutionRow(supabase, id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.approvalStatus !== "pending") return fail(NOT_PENDING_REJECT_ERROR);

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("automation_executions")
    .update({ approval_status: "rejected", approved_by: approverId, approved_at: nowIso, status: "rejected", completed_at: nowIso })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapAutomationExecutionRow(data));
}

async function getApprovalOverride(workspaceId: string, automationId: string): Promise<boolean | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("automation_approval_overrides")
    .select("required")
    .eq("workspace_id", workspaceId)
    .eq("automation_id", automationId)
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return (data as ApprovalOverrideRow | null)?.required ?? null;
}

async function setApprovalOverride(workspaceId: string, automationId: string, required: boolean): Promise<DataResult<void>> {
  const supabase = createSupabaseClient();
  const { error } = await supabase
    .from("automation_approval_overrides")
    .upsert({ workspace_id: workspaceId, automation_id: automationId, required }, { onConflict: "workspace_id,automation_id" });
  if (error) throw normalizeSupabaseError(error);
  return ok(undefined);
}

export const supabaseAutomationRepository: AutomationRepository = {
  recordExecution,
  getRecentExecutions,
  getExecutionById,
  getPendingApprovals,
  approveExecution,
  rejectExecution,
  getApprovalOverride,
  setApprovalOverride,
};
