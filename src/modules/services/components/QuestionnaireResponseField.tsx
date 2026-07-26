"use client";

import { useId } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import type { ServiceQuestionnaireQuestion } from "@/types/serviceQuestionnaireQuestion";
import type { EventServiceQuestionnaireResponseInput } from "@/modules/services/schema";

/** Mirrors `EventServiceQuestionnaireResponseInput` minus `question_id` (the field always knows its own question) — so a caller can pass this value straight into `useSubmitEventServiceQuestionnaireResponse` by adding `question_id` back, with no reshaping in between. */
export type QuestionnaireResponseValue = Omit<EventServiceQuestionnaireResponseInput, "question_id">;

interface QuestionnaireResponseFieldProps {
  question: ServiceQuestionnaireQuestion;
  value: QuestionnaireResponseValue;
  onChange: (value: QuestionnaireResponseValue) => void;
  /** Explicit commit — this field never autosaves on every keystroke/toggle, matching the same "confirmed server response only" pattern the EventService override fields already use. */
  onSubmit: () => void;
  disabled?: boolean;
  error?: string;
  saving?: boolean;
  className?: string;
}

const EMPTY_RESPONSE: QuestionnaireResponseValue = {
  response_text: null,
  response_options: null,
  response_boolean: null,
  response_date: null,
};

/** Convenience for callers building initial field state — every response_* field starts null except the one the question's own type will use. */
export function emptyQuestionnaireResponseValue(): QuestionnaireResponseValue {
  return { ...EMPTY_RESPONSE };
}

/**
 * Renders the control matching the question's ACTUAL domain type — only
 * the six real `ServiceQuestionType` members
 * (short_text/long_text/single_choice/multi_choice/boolean/date), nothing
 * speculative. Never calls a mutation itself: `onChange` updates the
 * caller's local buffer, `onSubmit` commits it, and the caller owns wiring
 * `onSubmit` to `useSubmitEventServiceQuestionnaireResponse`.
 */
export function QuestionnaireResponseField({ question, value, onChange, onSubmit, disabled = false, error, saving = false, className = "" }: QuestionnaireResponseFieldProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const descriptionId = `${fieldId}-description`;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-1.5 ${className}`}>
      <label htmlFor={fieldId} className="block text-xs text-text/70">
        {question.question_text}
        {question.is_required ? <span className="text-accent"> *</span> : null}
      </label>

      {renderControl({ question, value, onChange, disabled: disabled || saving, fieldId, describedBy: error ? errorId : descriptionId })}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" variant="secondary" disabled={disabled || saving}>
          {saving ? "Saving…" : "Save answer"}
        </Button>
      </div>
    </form>
  );
}

interface RenderControlArgs {
  question: ServiceQuestionnaireQuestion;
  value: QuestionnaireResponseValue;
  onChange: (value: QuestionnaireResponseValue) => void;
  disabled: boolean;
  fieldId: string;
  describedBy: string;
}

function renderControl({ question, value, onChange, disabled, fieldId, describedBy }: RenderControlArgs) {
  switch (question.question_type) {
    case "short_text":
      return (
        <Input
          id={fieldId}
          aria-describedby={describedBy}
          value={value.response_text ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ ...EMPTY_RESPONSE, response_text: event.target.value })}
        />
      );

    case "long_text":
      return (
        <Textarea
          id={fieldId}
          aria-describedby={describedBy}
          value={value.response_text ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ ...EMPTY_RESPONSE, response_text: event.target.value })}
        />
      );

    case "boolean":
      return (
        <div role="radiogroup" aria-describedby={describedBy} className="flex gap-4">
          {(["Yes", "No"] as const).map((label) => {
            const boolValue = label === "Yes";
            return (
              <label key={label} className="flex items-center gap-1.5 text-sm text-text">
                <input
                  type="radio"
                  name={fieldId}
                  disabled={disabled}
                  checked={value.response_boolean === boolValue}
                  onChange={() => onChange({ ...EMPTY_RESPONSE, response_boolean: boolValue })}
                  className="h-4 w-4 accent-accent"
                />
                {label}
              </label>
            );
          })}
        </div>
      );

    case "date":
      return (
        <Input
          id={fieldId}
          type="date"
          aria-describedby={describedBy}
          value={value.response_date ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ ...EMPTY_RESPONSE, response_date: event.target.value || null })}
        />
      );

    case "single_choice":
      return (
        <div role="radiogroup" aria-describedby={describedBy} className="space-y-1.5">
          {(question.options ?? []).map((option) => (
            <label key={option} className="flex items-center gap-1.5 text-sm text-text">
              <input
                type="radio"
                name={fieldId}
                disabled={disabled}
                checked={(value.response_options ?? [])[0] === option}
                onChange={() => onChange({ ...EMPTY_RESPONSE, response_options: [option] })}
                className="h-4 w-4 accent-accent"
              />
              {option}
            </label>
          ))}
        </div>
      );

    case "multi_choice":
      return (
        <div aria-describedby={describedBy} className="space-y-1.5">
          {(question.options ?? []).map((option) => {
            const selected = (value.response_options ?? []).includes(option);
            return (
              <label key={option} className="flex items-center gap-1.5 text-sm text-text">
                <Checkbox
                  disabled={disabled}
                  checked={selected}
                  onChange={(event) => {
                    const current = value.response_options ?? [];
                    const next = event.target.checked ? [...current, option] : current.filter((entry) => entry !== option);
                    onChange({ ...EMPTY_RESPONSE, response_options: next.length > 0 ? next : null });
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      );

    default:
      throw new Error(`QuestionnaireResponseField received an unknown question_type: "${question.question_type satisfies never}"`);
  }
}
