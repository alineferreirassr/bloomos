import { evaluateFeatureFlag } from "@/core/featureFlags";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { AutomationCondition, AutomationConditionOperator, AutomationTriggerEvent } from "@/types/automation";

export interface AutomationConditionContext {
  trigger: AutomationTriggerEvent;
  role: WorkspaceMemberRole | null;
}

function compare(operator: AutomationConditionOperator, actual: unknown, expected: AutomationCondition["value"]): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":
      return Array.isArray(expected) && (typeof actual === "string" || typeof actual === "number") && expected.includes(actual);
    case "notIn":
      return Array.isArray(expected) && (typeof actual === "string" || typeof actual === "number") && !expected.includes(actual);
    default:
      return false;
  }
}

/**
 * Resolves one condition's own "actual" value from the execution context —
 * `role`/`workspaceId` come from the acting member's own session, never the
 * trigger's own `facts` (a trigger can't forge who's running it); every
 * other field reads from `trigger.facts` by the same key name. `featureFlag`
 * is the one field requiring an async lookup (`evaluateFeatureFlag`) — its
 * own `value` names the flag key to check, and the condition passes when
 * that flag's own boolean state matches `operator === "eq"` (checking
 * *enabled*) or its inverse (`"neq"`, checking *disabled*).
 */
async function resolveAndEvaluate(condition: AutomationCondition, context: AutomationConditionContext): Promise<boolean> {
  if (condition.field === "featureFlag") {
    const enabled = await evaluateFeatureFlag(context.trigger.workspaceId, String(condition.value));
    return condition.operator === "eq" ? enabled : condition.operator === "neq" ? !enabled : false;
  }

  const actual: unknown =
    condition.field === "role"
      ? context.role
      : condition.field === "workspaceId"
        ? context.trigger.workspaceId
        : context.trigger.facts[condition.field];

  return compare(condition.operator, actual, condition.value);
}

/**
 * The Step 3 Condition Engine — every condition must pass (AND-combined,
 * the same "no clever boolean algebra" bias every other evaluator in this
 * codebase already follows) for an Automation to proceed past this gate.
 * Deterministic: the same trigger event, role, and Feature Flag state
 * always produce the same result — there is no condition field through
 * which a model's own output could ever be referenced, so "never evaluate
 * AI prompts here" holds by construction, not by convention.
 */
export async function evaluateConditions(conditions: AutomationCondition[], context: AutomationConditionContext): Promise<boolean> {
  for (const condition of conditions) {
    const passed = await resolveAndEvaluate(condition, context);
    if (!passed) return false;
  }
  return true;
}
