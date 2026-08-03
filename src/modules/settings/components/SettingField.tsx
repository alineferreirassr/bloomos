"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import type { SettingSummary } from "@/modules/settings/getSettingsPageData";
import type { UpdateSettingActionResult } from "@/modules/settings/updateSettingAction";
import type { SettingValue } from "@/types/settings";

interface SettingFieldProps {
  setting: SettingSummary;
  value: SettingValue;
  onSave: (settingId: string, value: SettingValue) => Promise<UpdateSettingActionResult>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * The Step 20 "generic setting renderer" — the entire Settings UI's own
 * proof of "no hardcoded module-specific logic": this component switches on
 * `setting.type` (a closed 5-value enum) and `setting.visibility`, never on
 * `setting.id`. A 15th module's Setting renders correctly here the instant
 * it's registered, with zero changes to this file.
 */
export function SettingField({ setting, value, onSave }: SettingFieldProps) {
  const [draft, setDraft] = useState<SettingValue>(value);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [issues, setIssues] = useState<string[]>([]);

  const readonly = setting.visibility === "readonly";

  async function commit(next: SettingValue) {
    if (readonly || next === value) return;
    setSaveState("saving");
    const result = await onSave(setting.id, next);
    if (result.success) {
      setSaveState("saved");
      setIssues([]);
    } else {
      setSaveState("error");
      setIssues(result.issues.map((issue) => issue.message));
      setDraft(value);
    }
  }

  const fieldId = `setting-${setting.id}`;

  return (
    <div className="flex flex-col gap-1.5 border-b border-border/60 py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[55%]">
        <label htmlFor={fieldId} className="flex items-center gap-1.5 font-serif text-sm font-semibold text-text">
          {setting.label}
          {setting.required ? <span className="text-danger">*</span> : null}
          {setting.visibility === "advanced" ? <Badge tone="outline">Advanced</Badge> : null}
          {readonly ? <Badge tone="outline">Read-only</Badge> : null}
        </label>
        <p className="mt-0.5 text-xs text-text/55">{setting.description}</p>
        {issues.length > 0 ? (
          <ul role="alert" className="mt-1 space-y-0.5 text-xs text-danger">
            {issues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="w-full sm:w-64 shrink-0">
        {setting.type === "boolean" ? (
          <div className="flex items-center gap-2 sm:justify-end">
            <Checkbox
              id={fieldId}
              checked={Boolean(draft)}
              disabled={readonly}
              onChange={(event) => {
                const next = event.target.checked;
                setDraft(next);
                void commit(next);
              }}
            />
          </div>
        ) : setting.type === "select" ? (
          <Select
            id={fieldId}
            value={typeof draft === "string" ? draft : ""}
            disabled={readonly}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              void commit(next);
            }}
          >
            {(setting.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : setting.type === "color" ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              id={fieldId}
              value={typeof draft === "string" && draft ? draft : "#000000"}
              disabled={readonly}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={(event) => void commit(event.target.value)}
              className="h-9 w-12 shrink-0 rounded-md border border-border bg-transparent disabled:opacity-45"
            />
            <Input
              value={typeof draft === "string" ? draft : ""}
              disabled={readonly}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={(event) => void commit(event.target.value)}
            />
          </div>
        ) : setting.type === "number" ? (
          <Input
            id={fieldId}
            type="number"
            value={typeof draft === "number" ? draft : typeof draft === "string" ? draft : ""}
            disabled={readonly}
            onChange={(event) => setDraft(event.target.value === "" ? null : Number(event.target.value))}
            onBlur={(event) => void commit(event.target.value === "" ? null : Number(event.target.value))}
          />
        ) : (
          <Input
            id={fieldId}
            type="text"
            value={typeof draft === "string" ? draft : ""}
            disabled={readonly}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => void commit(event.target.value)}
          />
        )}
        {!readonly && saveState === "saving" ? <p className="mt-1 text-right text-[11px] text-text/45">Saving…</p> : null}
        {!readonly && saveState === "saved" ? <p className="mt-1 text-right text-[11px] text-accent">Saved</p> : null}
      </div>
    </div>
  );
}
