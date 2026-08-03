"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  applyWritingAction,
  WRITING_ACTIONS,
  WRITING_ACTION_LABELS,
  WRITING_TASK_TYPES,
  WRITING_TASK_LABELS,
  type WritingAction,
  type WritingTaskType,
  type WritingResult,
} from "@/core/ai/copilot/writingEngine";

/** Checkpoint 20, Steps 9-10 — the standalone AI Writing Studio page, reachable from the Copilot Panel's footer link. Same engine `WritingStudioModal.tsx` uses when embedded (e.g. in the Proposal Assistant). */
export function WritingStudioView() {
  const [taskType, setTaskType] = useState<WritingTaskType>("email");
  const [action, setAction] = useState<WritingAction>("rewrite");
  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState<WritingResult | null>(null);

  function runAction() {
    setResult(applyWritingAction({ taskType, action, sourceText }));
  }

  return (
    <div>
      <PageHeader title="Writing Studio" subtitle="Rewrite, shorten, or adjust the tone of any text — no AI provider connected yet, so every transform here is deterministic and clearly labeled as such." />

      <div className="max-w-2xl space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block text-xs font-medium text-text-muted">
            Type
            <Select value={taskType} onChange={(event) => setTaskType(event.target.value as WritingTaskType)} className="mt-1">
              {WRITING_TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WRITING_TASK_LABELS[type]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-xs font-medium text-text-muted">
            Action
            <Select value={action} onChange={(event) => setAction(event.target.value as WritingAction)} className="mt-1">
              {WRITING_ACTIONS.map((writingAction) => (
                <option key={writingAction} value={writingAction}>
                  {WRITING_ACTION_LABELS[writingAction]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <label className="block text-xs font-medium text-text-muted">
          Your text
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
            placeholder="Paste or write the text you want Bloom AI to work on…"
          />
        </label>

        <Button type="button" onClick={runAction} disabled={sourceText.trim() === ""}>
          Run
        </Button>

        {result ? (
          <div className="space-y-2 rounded-md bg-surface-tint p-3">
            {!result.applied ? <p className="text-xs text-warning">{result.note}</p> : null}
            <p className="text-sm whitespace-pre-wrap text-text">{result.outputText}</p>
            {result.applied && result.note ? <p className="text-xs text-text-muted">{result.note}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
