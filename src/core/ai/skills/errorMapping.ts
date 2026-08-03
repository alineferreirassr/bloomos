import type { SkillExecutionError } from "@/core/ai/skills/types";

export interface SkillErrorMessages {
  contextUnavailable: string;
  provider: string;
  malformed: string;
  semantic?: string;
  permissionDenied?: string;
}

/**
 * Every migrated feature keeps its own exact, already-tested error strings
 * (`GENERIC_ACCESS_ERROR`, `GENERIC_PROVIDER_ERROR`, etc.) — this only maps
 * a `SkillExecutionError`'s *category* to which of those strings applies,
 * so that mapping logic (not the strings themselves) exists once.
 */
export function mapSkillErrorToMessage(error: SkillExecutionError, messages: SkillErrorMessages): string {
  switch (error.category) {
    case "context_unavailable":
      return messages.contextUnavailable;
    case "permission_denied":
    case "approval_required":
      return messages.permissionDenied ?? messages.provider;
    case "malformed_output":
    case "schema_failure":
      return messages.malformed;
    case "semantic_failure":
      return messages.semantic ?? messages.malformed;
    case "invalid_request":
    case "provider_failure":
    case "timeout":
    case "unavailable_provider":
    case "fallback_exhausted":
    default:
      return messages.provider;
  }
}
