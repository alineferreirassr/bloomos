import { AUTOMATION_CONDITION_FIELDS, AUTOMATION_CONDITION_OPERATORS } from "@/types/automation";
import { DYNAMIC_CONDITION_EXISTS_TARGET, DYNAMIC_CONDITION_FIELD_TARGET, DYNAMIC_CONDITION_SWITCH_TARGET } from "@/types/workflow";
import type { WorkflowNodeDefinition, WorkflowNodeValidationContext } from "@/types/workflow";

/**
 * The Step 9 built-in Condition nodes. Each is fixed to exactly one
 * `AutomationConditionField` (named in `compileTarget`) — the node
 * instance's own `data` only ever needs `{operator, value}`, matching the
 * field/operator/value shape `AutomationCondition` already has. Deliberately
 * a subset of all 8 `AUTOMATION_CONDITION_FIELDS` (omits `eventType`/
 * `contractStatus`) — this checkpoint's own spec lists exactly these 6.
 */
function validateConditionData(context: WorkflowNodeValidationContext): string | null {
  const { operator, value } = context.node.data;
  if (typeof operator !== "string" || !(AUTOMATION_CONDITION_OPERATORS as readonly string[]).includes(operator)) {
    return "This Condition node needs a valid operator selected.";
  }
  if (value === null || value === undefined || value === "") {
    return "This Condition node needs a comparison value.";
  }
  return null;
}

function makeConditionNode(
  overrides: Pick<WorkflowNodeDefinition, "id" | "name" | "description" | "icon" | "compileTarget"> & Partial<Pick<WorkflowNodeDefinition, "validate">>,
): WorkflowNodeDefinition {
  return {
    kind: "condition",
    category: "condition",
    color: "warning",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    validate: validateConditionData,
    ...overrides,
  };
}

export const roleCondition = makeConditionNode({
  id: "condition.role",
  name: "Role",
  description: "Branches based on the acting member's own Workspace role.",
  icon: "UserCog",
  compileTarget: "role",
});

export const featureFlagCondition = makeConditionNode({
  id: "condition.feature-flag",
  name: "Feature Flag",
  description: "Branches based on whether a named Feature Flag is enabled for this Workspace.",
  icon: "ToggleLeft",
  compileTarget: "featureFlag",
});

export const workspaceCondition = makeConditionNode({
  id: "condition.workspace",
  name: "Workspace",
  description: "Branches based on the triggering Workspace's own id.",
  icon: "Building2",
  compileTarget: "workspaceId",
});

export const invoiceAmountCondition = makeConditionNode({
  id: "condition.invoice-amount",
  name: "Invoice Amount",
  description: "Branches based on the triggering Invoice's own amount, in minor currency units.",
  icon: "DollarSign",
  compileTarget: "invoiceAmountMinor",
});

export const proposalValueCondition = makeConditionNode({
  id: "condition.proposal-value",
  name: "Proposal Value",
  description: "Branches based on the triggering Proposal's own value, in minor currency units.",
  icon: "Tag",
  compileTarget: "proposalValueMinor",
});

export const daysOverdueCondition = makeConditionNode({
  id: "condition.days-overdue",
  name: "Days Overdue",
  description: "Branches based on how many days overdue the triggering Invoice is.",
  icon: "CalendarClock",
  compileTarget: "daysOverdue",
});

/**
 * Checkpoint 13's own generic Condition nodes — If, Compare, Exists, and
 * Switch. Unlike every node above, none of these is fixed to one
 * `AutomationConditionField`: the member picks the field per node
 * *instance* (`data.field`, one of `AUTOMATION_CONDITION_FIELDS`), so a
 * single node type covers all 8 fields instead of needing 8 separate
 * registrations. `compileTarget` is one of the three sentinels from
 * `types/workflow.ts` — `core/workflow/compiler.ts`'s `conditionFromNode`
 * checks for these before its original fixed-field path.
 */
function validateDynamicFieldData(context: WorkflowNodeValidationContext): string | null {
  const { field } = context.node.data;
  if (typeof field !== "string" || !(AUTOMATION_CONDITION_FIELDS as readonly string[]).includes(field)) {
    return "This Condition node needs a field selected.";
  }
  return validateConditionData(context);
}

export const ifCondition = makeConditionNode({
  id: "condition.if",
  name: "If",
  description: "Branches on any one field — pick the field, operator, and value to compare.",
  icon: "ToggleLeft",
  compileTarget: DYNAMIC_CONDITION_FIELD_TARGET,
  validate: validateDynamicFieldData,
});

export const compareCondition = makeConditionNode({
  id: "condition.compare",
  name: "Compare",
  description: "Numerically compares any one field against a threshold value (greater than, less than, etc.).",
  icon: "TrendingUp",
  compileTarget: DYNAMIC_CONDITION_FIELD_TARGET,
  validate: validateDynamicFieldData,
});

function validateExistsData(context: WorkflowNodeValidationContext): string | null {
  const { field } = context.node.data;
  if (typeof field !== "string" || !(AUTOMATION_CONDITION_FIELDS as readonly string[]).includes(field)) {
    return "This Condition node needs a field selected.";
  }
  return null;
}

export const existsCondition = makeConditionNode({
  id: "condition.exists",
  name: "Exists",
  description: "Branches on whether any one field is set at all — no operator or value to configure.",
  icon: "Eye",
  compileTarget: DYNAMIC_CONDITION_EXISTS_TARGET,
  validate: validateExistsData,
});

function validateSwitchData(context: WorkflowNodeValidationContext): string | null {
  const { field, cases } = context.node.data;
  if (typeof field !== "string" || !(AUTOMATION_CONDITION_FIELDS as readonly string[]).includes(field)) {
    return "This Switch node needs a field selected.";
  }
  if (typeof cases !== "string" || cases.trim().length === 0) {
    return "This Switch node needs at least one comma-separated case value.";
  }
  return null;
}

/**
 * `data.cases` is stored as one comma-separated string (matching every
 * other node's own flat `Record<string, string|number|boolean|null>` data
 * shape — no arrays), split at compile time. Compiles to a set-membership
 * check (`in`/`notIn` against the same field) rather than true N-way
 * branching: `WorkflowEdge.branch` stays the closed `"true"|"false"|null`
 * every other Condition node already uses, so Switch needs zero changes
 * to the Graph model, the Compiler's path enumeration, or the Canvas —
 * "true" means "the field matched one of the configured cases," "false"
 * means it matched none of them.
 */
export const switchCondition = makeConditionNode({
  id: "condition.switch",
  name: "Switch",
  description: "Branches on whether any one field's value is in a set of cases you list (comma-separated).",
  icon: "ListChecks",
  compileTarget: DYNAMIC_CONDITION_SWITCH_TARGET,
  validate: validateSwitchData,
});

export const conditionNodes: WorkflowNodeDefinition[] = [
  roleCondition,
  featureFlagCondition,
  workspaceCondition,
  invoiceAmountCondition,
  proposalValueCondition,
  daysOverdueCondition,
  ifCondition,
  compareCondition,
  existsCondition,
  switchCondition,
];
