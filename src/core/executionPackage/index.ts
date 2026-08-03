import { mockExecutionPackagesRepository } from "@/lib/data/mock/executionPackagesStore";

export type { ExecutionPackage, ExecutionStatus, ExecutionPriority, ExecutionSource, ExecutionContext, ExecutionContextType, ExecutionMetadata } from "@/types/executionPackage";
export type { ExecutionVersion, ExecutionSnapshot } from "@/types/executionPackage";
export type { ExecutionInstructions, ExecutionInstructionLine, ExecutionInstructionSection } from "@/types/executionPackage";
export type { ExecutionAttachment, ExecutionAttachmentType } from "@/types/executionPackage";

export type { CreateExecutionPackageInput, CreateVersionInput, ExecutionPackagesRepository } from "@/lib/data/mock/executionPackagesStore";

/** v2.0 Checkpoint 27.3 — Mock-only accessor, same precedent as `core/allocation`/`core/operationalPlanning`. No Supabase table exists yet for any Execution Package concept. */
export function getCoreExecutionPackagesService() {
  return mockExecutionPackagesRepository;
}
