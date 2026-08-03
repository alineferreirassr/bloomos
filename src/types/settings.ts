import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

/**
 * Checkpoint 11 — the Settings Platform's own domain. Framework-agnostic,
 * the same discipline `types/automation.ts`/`types/workflow.ts` already
 * established: nothing here imports React or any rendering concern.
 *
 * Two open registries, not one: a **Section** (`SettingsSectionDefinition`)
 * is purely organizational — a place in the left nav, an icon, a display
 * order. A **Setting** (`SettingDefinition`) is one configurable value,
 * always pointing at exactly one Section via `sectionId`. Both are open,
 * registry-based (never a closed enum) — this checkpoint's own spec says
 * "Future sections should self-register" and "Every module registers its
 * own settings," so unlike the Trigger/Kind closed-enum split in
 * Checkpoints 9–10, there is no fixed set here at all: a 15th Section or a
 * 46th Setting needs exactly one registration call, nothing more.
 */

/** A loose, display-only grouping within a Section — e.g. `"ai"` section's own settings might split into `"provider"` vs `"memory-policy"` categories. Open (a plain string), never a closed enum — Step 1 asks for "Category" without naming a fixed set. */
export type SettingsCategory = string;

export const SETTING_VALUE_TYPES = ["string", "number", "boolean", "select", "color"] as const;
export type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

export type SettingValue = string | number | boolean | null;

/**
 * Step 1's own "Visibility" concept — distinct from permission/role/flag
 * gating (which controls whether a member may even *see* the setting at
 * all): `"visible"` renders normally, `"advanced"` renders only once an
 * "Advanced" toggle is opened (still fully editable), `"readonly"` renders
 * but can never be edited through the UI (e.g. `AI: Provider`, derived from
 * `isAIConfigured()` rather than stored), `"hidden"` never renders at all
 * (reserved for a setting mid-rollout).
 */
export const SETTING_VISIBILITIES = ["visible", "advanced", "readonly", "hidden"] as const;
export type SettingVisibility = (typeof SETTING_VISIBILITIES)[number];

export interface SelectSettingOption {
  label: string;
  value: string;
}

export interface SettingValidationContext {
  value: SettingValue;
  setting: SettingDefinition;
}

/**
 * The Step 13 "every setting must support" contract, expressed as fields
 * (`type`/`required`/`defaultValue`/`requiredPermissions`/`featureFlag`)
 * checked by the shared `core/settings/validation.ts` engine, plus one
 * optional escape hatch (`validate`) for a check a type/required/permission
 * rule alone can't express (e.g. "must be between 0 and 1" for AI
 * Temperature) — the same "closed-shape-plus-one-escape-hatch" pattern
 * `WorkflowNodeDefinition.validate` already established.
 */
export interface SettingDefinition {
  id: string;
  sectionId: string;
  category: SettingsCategory | null;
  label: string;
  description: string;
  /** Extra search terms beyond `label`/`description` — e.g. `"ai.temperature"` also matching "creativity," "randomness." Step 14's own Global Search reads this. */
  keywords: string[];
  type: SettingValueType;
  /** Required when `type === "select"`; ignored otherwise. */
  options?: SelectSettingOption[];
  defaultValue: SettingValue;
  required: boolean;
  visibility: SettingVisibility;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  version: string;
  validate?: (context: SettingValidationContext) => string | null;
}

export interface SettingsSectionDefinition {
  id: string;
  label: string;
  description: string;
  /** A name from the same fixed icon lookup map the Workflow Node Library already established (`modules/settings/sectionIcons.ts`) — a string, never a React component reference, keeping this declaration importable from server code. */
  icon: string;
  /** Display order in the section nav — lower first. Ties broken alphabetically by label. */
  order: number;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
}

export const SETTING_ISSUE_CODES = [
  "invalid_type",
  "required_missing",
  "invalid_option",
  "custom_validation_failed",
  "permission_denied",
  "feature_flag_disabled",
  "unknown_setting",
] as const;
export type SettingIssueCode = (typeof SETTING_ISSUE_CODES)[number];

export interface SettingIssue {
  code: SettingIssueCode;
  settingId: string;
  message: string;
}

export type SettingValidationResult = { valid: true } | { valid: false; issues: SettingIssue[] };

/**
 * The Step 15 Dashboard's own "Recently Changed" — an append-only audit
 * record, the same precedent every other History/Audit concept in this
 * codebase already follows (Automation Execution History, Workflow Version
 * History). Stores the actual before/after values — this is legitimate,
 * visible-to-admins audit data, a different contract than the
 * observability *logger*'s own "never log sensitive values" rule (Step 19),
 * which governs `core/observability/logger` calls, not this persisted
 * record.
 */
export interface SettingChangeRecord {
  id: string;
  workspaceId: string;
  settingId: string;
  previousValue: SettingValue;
  newValue: SettingValue;
  changedBy: string;
  changedAt: string;
}

/**
 * Step 16's own "Bloom AI may recommend configuration changes" —
 * deterministic (a rule over the real Settings Registry/current values,
 * never a generative call), and inert until a human explicitly applies it:
 * nothing holding one of these ever writes a setting value by itself.
 */
export interface SettingRecommendation {
  settingId: string;
  currentValue: SettingValue;
  recommendedValue: SettingValue;
  reason: string;
}
