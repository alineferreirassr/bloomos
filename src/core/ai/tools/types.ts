import type { ZodType } from "zod";

export type AIToolApprovalPolicy = "always_required" | "not_required";

export interface AIToolExecutionContext {
  workspaceId: string;
  userId: string;
  /** Same permission strings used everywhere else in BloomOS (`core/permissions`) — a Tool never invents its own permission model. */
  permissions: string[];
  /** Set only once a human has explicitly approved this specific tool call — never inferred, always supplied by the caller after a real approval step (e.g. a confirmation dialog), matching `PRODUCT_PRINCIPLES.md` #4. */
  approved?: boolean;
}

/**
 * Everything the platform needs to safely expose one callable action to
 * Bloom AI. Generic input/output types are intentionally erased to
 * `unknown` at the registry boundary — same trade-off `AIUseCaseDefinition`
 * (`prompts/types.ts`) already makes, since a heterogeneous `Map` can't
 * preserve per-entry generics; `executeAITool`'s Zod validation is what
 * keeps a caller's actual input/output honest despite the erasure.
 */
export interface AIToolDefinition {
  toolId: string;
  description: string;
  inputSchema: ZodType;
  outputSchema: ZodType;
  /** A required permission the acting user must already hold, or `undefined` if the tool needs none beyond a resolved session. */
  requiredPermission?: string;
  /** Client-facing, contractual, operational-status, and financial mutations must declare `"always_required"` — the same rule `AIUseCaseDefinition.humanApprovalPolicy` enforces for use cases, applied here to individual callable actions. */
  approvalPolicy: AIToolApprovalPolicy;
  execute: (input: unknown, context: AIToolExecutionContext) => Promise<unknown>;
}
