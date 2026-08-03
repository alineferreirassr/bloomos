"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { WorkflowIssue } from "@/types/workflow";

export function PublishDialog({
  open,
  onClose,
  issues,
  publishing,
  onConfirm,
  currentVersion,
}: {
  open: boolean;
  onClose: () => void;
  issues: WorkflowIssue[];
  publishing: boolean;
  onConfirm: () => void;
  currentVersion: number;
}) {
  const canPublish = issues.length === 0;

  return (
    <Modal open={open} onClose={onClose} title="Publish Workflow">
      <div className="space-y-3">
        <p className="text-sm text-text">
          {canPublish
            ? `This will compile the current graph into real Automation Definitions and register them — version ${currentVersion + 1}. Every previously published Automation from this Workflow is superseded immediately.`
            : "This Workflow has validation errors and can't be published yet."}
        </p>

        {!canPublish ? (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="rounded-md border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-xs text-text">
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canPublish || publishing} onClick={onConfirm}>
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
