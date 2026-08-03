"use client";

import { AUTOMATION_CATEGORIES, WORKFLOW_SCHEDULE_FREQUENCIES, type AutomationCategory, type WorkflowScheduleFrequency } from "@/types/automation";
import { WORKSPACE_MEMBER_ROLES, WORKSPACE_MEMBER_ROLE_LABELS } from "@/core/enums/workspaceRole";
import type { WorkflowExecutionPolicy, WorkflowMetadata } from "@/types/workflow";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

const SCHEDULE_FREQUENCY_LABELS: Record<WorkflowScheduleFrequency, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The Step 7 Workflow Inspector — workflow-*level* settings, distinct from
 * the Properties Panel's per-node settings: name/description/category
 * (`WorkflowMetadata`) and the execution policy the Compiler copies onto
 * every Automation this Workflow produces (`WorkflowExecutionPolicy`).
 */
export function WorkflowInspectorPanel({
  metadata,
  executionPolicy,
  onChange,
}: {
  metadata: WorkflowMetadata;
  executionPolicy: WorkflowExecutionPolicy;
  onChange: (next: { metadata: WorkflowMetadata; executionPolicy: WorkflowExecutionPolicy }) => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <h3 className="font-serif text-[15px] font-semibold text-text">Workflow Inspector</h3>

      <div>
        <label htmlFor="inspector-name" className="block text-[11px] font-medium text-text-muted">
          Name
        </label>
        <input
          id="inspector-name"
          type="text"
          value={metadata.name}
          onChange={(event) => onChange({ metadata: { ...metadata, name: event.target.value }, executionPolicy })}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        />
      </div>

      <div>
        <label htmlFor="inspector-description" className="block text-[11px] font-medium text-text-muted">
          Description
        </label>
        <textarea
          id="inspector-description"
          value={metadata.description}
          onChange={(event) => onChange({ metadata: { ...metadata, description: event.target.value }, executionPolicy })}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        />
      </div>

      <div>
        <label htmlFor="inspector-category" className="block text-[11px] font-medium text-text-muted">
          Category
        </label>
        <select
          id="inspector-category"
          value={metadata.category}
          onChange={(event) => onChange({ metadata: { ...metadata, category: event.target.value as AutomationCategory }, executionPolicy })}
          className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
        >
          {AUTOMATION_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-border pt-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Execution Policy</h4>
        <p className="mt-1 text-[11px] text-text-muted">Applied to every Automation this Workflow compiles into.</p>

        <div className="mt-2">
          <label htmlFor="inspector-min-role" className="block text-[11px] font-medium text-text-muted">
            Minimum role
          </label>
          <select
            id="inspector-min-role"
            value={executionPolicy.minimumRole ?? ""}
            onChange={(event) =>
              onChange({ metadata, executionPolicy: { ...executionPolicy, minimumRole: event.target.value ? (event.target.value as WorkspaceMemberRole) : null } })
            }
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
          >
            <option value="">No minimum</option>
            {WORKSPACE_MEMBER_ROLES.map((role) => (
              <option key={role} value={role}>
                {WORKSPACE_MEMBER_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2">
          <label htmlFor="inspector-max-retries" className="block text-[11px] font-medium text-text-muted">
            Max retries per Action
          </label>
          <input
            id="inspector-max-retries"
            type="number"
            min={0}
            max={5}
            value={executionPolicy.maxRetries}
            onChange={(event) => onChange({ metadata, executionPolicy: { ...executionPolicy, maxRetries: Math.max(0, Number(event.target.value) || 0) } })}
            className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
          />
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Scheduled Execution</h4>
        <p className="mt-1 text-[11px] text-text-muted">
          v2.0 Checkpoint 39 — recorded here, but BloomOS has no background scheduler yet, so this doesn&apos;t fire on its own. This Workflow still runs from its own Trigger node(s) below.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <input
            id="inspector-schedule-enabled"
            type="checkbox"
            checked={executionPolicy.scheduledExecution !== null}
            onChange={(event) =>
              onChange({
                metadata,
                executionPolicy: {
                  ...executionPolicy,
                  scheduledExecution: event.target.checked ? { frequency: "daily", time: "09:00", dayOfWeek: null, dayOfMonth: null } : null,
                },
              })
            }
          />
          <label htmlFor="inspector-schedule-enabled" className="text-[11px] font-medium text-text-muted">
            Also run this Workflow on a schedule
          </label>
        </div>

        {executionPolicy.scheduledExecution ? (
          <div className="mt-2 space-y-2">
            <div>
              <label htmlFor="inspector-schedule-frequency" className="block text-[11px] font-medium text-text-muted">
                Frequency
              </label>
              <select
                id="inspector-schedule-frequency"
                value={executionPolicy.scheduledExecution.frequency}
                onChange={(event) =>
                  onChange({
                    metadata,
                    executionPolicy: {
                      ...executionPolicy,
                      scheduledExecution: { ...executionPolicy.scheduledExecution!, frequency: event.target.value as WorkflowScheduleFrequency },
                    },
                  })
                }
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
              >
                {WORKFLOW_SCHEDULE_FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {SCHEDULE_FREQUENCY_LABELS[frequency]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inspector-schedule-time" className="block text-[11px] font-medium text-text-muted">
                Time (workspace-local)
              </label>
              <input
                id="inspector-schedule-time"
                type="time"
                value={executionPolicy.scheduledExecution.time}
                onChange={(event) =>
                  onChange({
                    metadata,
                    executionPolicy: { ...executionPolicy, scheduledExecution: { ...executionPolicy.scheduledExecution!, time: event.target.value } },
                  })
                }
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
              />
            </div>

            {executionPolicy.scheduledExecution.frequency === "weekly" ? (
              <div>
                <label htmlFor="inspector-schedule-weekday" className="block text-[11px] font-medium text-text-muted">
                  Day of week
                </label>
                <select
                  id="inspector-schedule-weekday"
                  value={executionPolicy.scheduledExecution.dayOfWeek ?? 0}
                  onChange={(event) =>
                    onChange({
                      metadata,
                      executionPolicy: { ...executionPolicy, scheduledExecution: { ...executionPolicy.scheduledExecution!, dayOfWeek: Number(event.target.value) } },
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {executionPolicy.scheduledExecution.frequency === "monthly" ? (
              <div>
                <label htmlFor="inspector-schedule-day" className="block text-[11px] font-medium text-text-muted">
                  Day of month
                </label>
                <input
                  id="inspector-schedule-day"
                  type="number"
                  min={1}
                  max={28}
                  value={executionPolicy.scheduledExecution.dayOfMonth ?? 1}
                  onChange={(event) =>
                    onChange({
                      metadata,
                      executionPolicy: {
                        ...executionPolicy,
                        scheduledExecution: { ...executionPolicy.scheduledExecution!, dayOfMonth: Math.min(28, Math.max(1, Number(event.target.value) || 1)) },
                      },
                    })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
