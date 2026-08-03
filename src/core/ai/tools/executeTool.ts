import { getAITool } from "@/core/ai/tools/registry";
import type { AIToolExecutionContext } from "@/core/ai/tools/types";
import type { AIError } from "@/core/ai/errors";

export type AIToolExecutionResult = { success: true; data: unknown } | { success: false; error: AIError };

/**
 * The single seam every AI-initiated tool call must go through — never a
 * tool's own `execute` directly. Enforces, in this fixed order, every
 * safety gate `PRODUCT_PRINCIPLES.md` #4 requires before a single line of
 * tool logic runs: the tool must exist, the acting user must hold its
 * required permission, a human must have already approved the call if the
 * tool demands it, and the input must match its declared schema. The
 * output is validated too, since a tool's own bug producing a malformed
 * result should surface as a typed `AIError`, not leak an unchecked shape
 * to a caller that trusted this seam to enforce it.
 */
export async function executeAITool(toolId: string, input: unknown, context: AIToolExecutionContext): Promise<AIToolExecutionResult> {
  const tool = getAITool(toolId);
  if (!tool) {
    return { success: false, error: { category: "invalid_request", message: `No AI tool is registered for "${toolId}".` } };
  }

  if (tool.requiredPermission && !context.permissions.includes(tool.requiredPermission)) {
    return { success: false, error: { category: "permission_denied", message: "You don't have permission to run this action." } };
  }

  if (tool.approvalPolicy === "always_required" && !context.approved) {
    return { success: false, error: { category: "approval_required", message: "This action requires explicit approval before it can run." } };
  }

  const parsedInput = tool.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: { category: "schema_failure", message: "The tool input didn't match the expected shape." } };
  }

  let rawOutput: unknown;
  try {
    rawOutput = await tool.execute(parsedInput.data, context);
  } catch {
    // Never surface the caught exception's own message — see runtime.ts's identical rule.
    return { success: false, error: { category: "provider_failure", message: "The tool failed to execute." } };
  }

  const parsedOutput = tool.outputSchema.safeParse(rawOutput);
  if (!parsedOutput.success) {
    return { success: false, error: { category: "schema_failure", message: "The tool's output didn't match the expected shape." } };
  }

  return { success: true, data: parsedOutput.data };
}
