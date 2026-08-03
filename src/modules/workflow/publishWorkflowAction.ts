"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { publishWorkflow } from "@/core/workflow/publisher";
import { getWorkflowManager } from "@/core/workflow/manager";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import type { WorkflowIssue, WorkflowVersion } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";
const ELEVATED_PERMISSION_ERROR = "Publishing a Workflow requires the workspace management permission.";

registerWorkflowNodes();

export type PublishWorkflowActionResult = { success: true; data: WorkflowVersion } | { success: false; error: string; issues?: WorkflowIssue[] };

/**
 * Step 15's own "Publishing requires elevated permission" — reuses
 * `workspace.manage`, the same permission `/settings` itself requires,
 * rather than introducing a new `workflow.*` permission (would need a
 * Supabase migration seeding it, out of scope this checkpoint — the same
 * precedent the Automation Dashboard's own route access already
 * established). Viewing/editing a draft Workflow needs only active
 * membership; only the irreversible act of publishing needs this check.
 */
export async function publishWorkflowAction(workflowId: string): Promise<PublishWorkflowActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: ELEVATED_PERMISSION_ERROR };

  const workflow = await getWorkflowManager().getWorkflowById(workflowId);
  if (!workflow || workflow.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await publishWorkflow(workflowId, session.user.id);
  if (!result.success) return { success: false, error: result.error, issues: result.issues };

  publishWebhookEvent({
    type: "workflow.published",
    workspaceId: session.workspace.id,
    resource: { type: "workflow", id: workflowId },
    payload: { id: workflowId, name: result.version.metadata.name, status: "published", updatedAt: result.version.publishedAt },
  });

  return { success: true, data: result.version };
}
