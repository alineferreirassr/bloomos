"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { AUTOMATION_CONDITION_FIELDS, AUTOMATION_CONDITION_OPERATORS } from "@/types/automation";
import { WORKSPACE_MEMBER_ROLES, WORKSPACE_MEMBER_ROLE_LABELS } from "@/core/enums/workspaceRole";
import { TIMELINE_ACTIVITY_TYPES } from "@/core/enums/timelineActivityType";
import { DYNAMIC_CONDITION_EXISTS_TARGET, DYNAMIC_CONDITION_FIELD_TARGET, DYNAMIC_CONDITION_SWITCH_TARGET } from "@/types/workflow";
import type { WorkflowNode } from "@/types/workflow";
import type { WorkflowNodeSummary } from "@/modules/workflow/getWorkflowEditorData";

const FIELD_LABEL: Record<string, string> = {
  role: "Role",
  workspaceId: "Workspace",
  eventType: "Event Type",
  invoiceAmountMinor: "Invoice Amount",
  daysOverdue: "Days Overdue",
  proposalValueMinor: "Proposal Value",
  contractStatus: "Contract Status",
  featureFlag: "Feature Flag",
};

const OPERATOR_LABEL: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  in: "is one of",
  notIn: "is not one of",
};

/**
 * The Step 7 Properties Panel — the one place a selected node's own
 * `data` is edited. What renders depends entirely on the node's own kind,
 * never a per-node-id special case: every Condition node gets the same
 * operator/value fields (its own `compileTarget` field name is shown as
 * context, not edited here — that's fixed by which node type was placed);
 * every role-restricted Approval node gets the same minimum-role select;
 * every other kind is read-only, since Triggers/Actions/Start/End carry no
 * author-configurable data this checkpoint.
 */
export function PropertiesPanel({
  selectedNode,
  nodeDefinition,
  onUpdateNodeData,
}: {
  selectedNode: WorkflowNode | null;
  nodeDefinition: WorkflowNodeSummary | null;
  onUpdateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void;
}) {
  if (!selectedNode || !nodeDefinition) {
    return (
      <div className="p-3">
        <h3 className="font-serif text-[15px] font-semibold text-text">Properties</h3>
        <EmptyState illustration="generic" title="No node selected" description="Select a node on the canvas to view or edit its own configuration." />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <h3 className="font-serif text-[15px] font-semibold text-text">Properties</h3>
        <p className="text-xs text-text-muted">{nodeDefinition.name}</p>
      </div>
      {selectedNode.kind === "condition" ? (
        <ConditionFields node={selectedNode} definition={nodeDefinition} onUpdateNodeData={onUpdateNodeData} />
      ) : selectedNode.kind === "approval" && nodeDefinition.compileTarget === "role_restricted" ? (
        <ApprovalFields node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      ) : nodeDefinition.id === "action.custom" ? (
        <CustomActionFields node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      ) : nodeDefinition.id === "trigger.timeline-event" ? (
        <TimelineEventTriggerFields node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      ) : nodeDefinition.id === "action.delay" ? (
        <DelayFields node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      ) : nodeDefinition.id === "action.loop" ? (
        <LoopFields node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
      ) : (
        <p className="text-xs text-text-muted">{nodeDefinition.description}</p>
      )}
    </div>
  );
}

const DYNAMIC_CONDITION_TARGETS: string[] = [DYNAMIC_CONDITION_FIELD_TARGET, DYNAMIC_CONDITION_EXISTS_TARGET, DYNAMIC_CONDITION_SWITCH_TARGET];

/**
 * Checkpoint 13's own If/Compare/Exists/Switch nodes are field-agnostic —
 * `definition.compileTarget` is a reserved sentinel, not a real field name
 * (see `types/workflow.ts`), so this panel adds a Field selector for them,
 * absent from every one of Checkpoint 10's own 6 fixed Condition nodes
 * (whose field is shown as read-only context instead, exactly as before).
 * Exists needs no operator/value at all; Switch swaps Value for a
 * comma-separated Cases input; If/Compare keep the original operator+value
 * fields, just with a field picker added above them.
 */
function ConditionFields({
  node,
  definition,
  onUpdateNodeData,
}: {
  node: WorkflowNode;
  definition: WorkflowNodeSummary;
  onUpdateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void;
}) {
  const [value, setValue] = useState(String(node.data.value ?? ""));
  const [cases, setCases] = useState(String(node.data.cases ?? ""));
  const operator = typeof node.data.operator === "string" ? node.data.operator : "eq";
  const field = typeof node.data.field === "string" ? node.data.field : "";
  const isDynamic = DYNAMIC_CONDITION_TARGETS.includes(definition.compileTarget ?? "");

  function commitValue() {
    const numeric = Number(value);
    onUpdateNodeData(node.id, { ...node.data, value: value !== "" && !Number.isNaN(numeric) ? numeric : value });
  }

  function commitCases() {
    onUpdateNodeData(node.id, { ...node.data, cases });
  }

  return (
    <div className="space-y-2.5">
      {isDynamic ? (
        <div>
          <label htmlFor="condition-field" className="block text-[11px] font-medium text-text-muted">
            Field
          </label>
          <select
            id="condition-field"
            value={field}
            onChange={(event) => onUpdateNodeData(node.id, { ...node.data, field: event.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
          >
            <option value="">Select a field…</option>
            {AUTOMATION_CONDITION_FIELDS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {FIELD_LABEL[candidate] ?? candidate}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Comparing <span className="font-medium text-text">{FIELD_LABEL[definition.compileTarget ?? ""] ?? definition.compileTarget}</span>
        </p>
      )}

      {definition.compileTarget === DYNAMIC_CONDITION_EXISTS_TARGET ? null : definition.compileTarget === DYNAMIC_CONDITION_SWITCH_TARGET ? (
        <div>
          <label htmlFor="condition-cases" className="block text-[11px] font-medium text-text-muted">
            Cases (comma-separated)
          </label>
          <input
            id="condition-cases"
            type="text"
            placeholder="gold, silver, bronze"
            value={cases}
            onChange={(event) => setCases(event.target.value)}
            onBlur={commitCases}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
          />
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="condition-operator" className="block text-[11px] font-medium text-text-muted">
              Operator
            </label>
            <select
              id="condition-operator"
              value={operator}
              onChange={(event) => onUpdateNodeData(node.id, { ...node.data, operator: event.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
            >
              {AUTOMATION_CONDITION_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABEL[op]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="condition-value" className="block text-[11px] font-medium text-text-muted">
              Value
            </label>
            <input
              id="condition-value"
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onBlur={commitValue}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
            />
          </div>
        </>
      )}
    </div>
  );
}

function CustomActionFields({ node, onUpdateNodeData }: { node: WorkflowNode; onUpdateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void }) {
  const [label, setLabel] = useState(String(node.data.label ?? ""));
  const [description, setDescription] = useState(String(node.data.description ?? ""));

  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor="custom-action-label" className="block text-[11px] font-medium text-text-muted">
          Label
        </label>
        <input
          id="custom-action-label"
          type="text"
          placeholder="e.g. Call the venue"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => onUpdateNodeData(node.id, { ...node.data, label })}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        />
      </div>
      <div>
        <label htmlFor="custom-action-description" className="block text-[11px] font-medium text-text-muted">
          Description (optional)
        </label>
        <input
          id="custom-action-description"
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => onUpdateNodeData(node.id, { ...node.data, description })}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        />
      </div>
      <p className="text-xs text-text-muted">A manual step outside BloomOS&rsquo;s own Actions — shown in Simulation order, never auto-executed.</p>
    </div>
  );
}

/**
 * v2.0 Checkpoint 39 — configures the one generic Timeline Event Trigger's
 * own `data.activityType`, the real Timeline activity type it narrows to
 * (see `triggerNodes.ts`'s own doc comment on `timelineEventTrigger`, and
 * `compiler.ts`'s `activityTypeCondition`). `TIMELINE_ACTIVITY_TYPES` is a
 * ~500-entry closed set, so this uses a searchable `<input list>` +
 * `<datalist>` rather than a plain `<select>` — the same native-HTML
 * pattern, just one an author can actually type to filter.
 */
function TimelineEventTriggerFields({ node, onUpdateNodeData }: { node: WorkflowNode; onUpdateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void }) {
  const [activityType, setActivityType] = useState(String(node.data.activityType ?? ""));
  const isValid = (TIMELINE_ACTIVITY_TYPES as readonly string[]).includes(activityType);

  function commit() {
    if (isValid) onUpdateNodeData(node.id, { ...node.data, activityType });
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor="timeline-event-activity-type" className="block text-[11px] font-medium text-text-muted">
          Timeline activity type
        </label>
        <input
          id="timeline-event-activity-type"
          type="text"
          list="timeline-activity-type-options"
          placeholder="e.g. contract_signed"
          value={activityType}
          onChange={(event) => setActivityType(event.target.value)}
          onBlur={commit}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        />
        <datalist id="timeline-activity-type-options">
          {TIMELINE_ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </div>
      {activityType && !isValid ? <p className="text-xs text-danger">Not a real Timeline activity type — pick one from the list.</p> : null}
      <p className="text-xs text-text-muted">Fires the first time any module records this exact Timeline activity type.</p>
    </div>
  );
}

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — configures the Delay
 * node's own `data.durationMinutes`. Stored as a real number (not a
 * string) since the Simulator's own estimated-duration total sums it
 * directly — see `delayActionNode`'s own doc comment for why nothing
 * enforces this at real execution time.
 */
function DelayFields({ node, onUpdateNodeData }: { node: WorkflowNode; onUpdateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void }) {
  const [duration, setDuration] = useState(String(node.data.durationMinutes ?? ""));

  function commit() {
    const numeric = Number(duration);
    onUpdateNodeData(node.id, { ...node.data, durationMinutes: duration !== "" && !Number.isNaN(numeric) && numeric > 0 ? numeric : null });
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor="delay-duration" className="block text-[11px] font-medium text-text-muted">
          Duration (minutes)
        </label>
        <input
          id="delay-duration"
          type="number"
          min={1}
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          onBlur={commit}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        />
      </div>
      <p className="text-xs text-text-muted">Recorded for planning and the Simulator&apos;s own estimated duration — not enforced at real execution time (no background scheduler exists yet).</p>
    </div>
  );
}

/** v2.0 Checkpoint 39 addendum — configures the Loop node's own `data.iterateOver`, a free-text description of what this planned repeat step would loop across. See `loopActionNode`'s own doc comment for why this never compiles to a real repeat. */
function LoopFields({ node, onUpdateNodeData }: { node: WorkflowNode; onUpdateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void }) {
  const [iterateOver, setIterateOver] = useState(String(node.data.iterateOver ?? ""));

  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor="loop-iterate-over" className="block text-[11px] font-medium text-text-muted">
          Iterate over
        </label>
        <input
          id="loop-iterate-over"
          type="text"
          placeholder="e.g. each assigned Worker"
          value={iterateOver}
          onChange={(event) => setIterateOver(event.target.value)}
          onBlur={() => onUpdateNodeData(node.id, { ...node.data, iterateOver })}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        />
      </div>
      <p className="text-xs text-text-muted">Records repeat intent for planning and Simulation — BloomOS has no iteration engine yet, so this step compiles to nothing at real execution time.</p>
    </div>
  );
}

function ApprovalFields({ node, onUpdateNodeData }: { node: WorkflowNode; onUpdateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void }) {
  const minimumApproverRole = typeof node.data.minimumApproverRole === "string" ? node.data.minimumApproverRole : "manager";

  return (
    <div>
      <label htmlFor="approval-role" className="block text-[11px] font-medium text-text-muted">
        Minimum approver role
      </label>
      <select
        id="approval-role"
        value={minimumApproverRole}
        onChange={(event) => onUpdateNodeData(node.id, { ...node.data, minimumApproverRole: event.target.value })}
        className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
      >
        {WORKSPACE_MEMBER_ROLES.map((role) => (
          <option key={role} value={role}>
            {WORKSPACE_MEMBER_ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </div>
  );
}
