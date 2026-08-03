import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QuestionnaireResponseField,
  emptyQuestionnaireResponseValue,
  type QuestionnaireResponseValue,
} from "@/modules/services/components/QuestionnaireResponseField";
import type { ServiceQuestionnaireQuestion } from "@/types/serviceQuestionnaireQuestion";
import type { ServiceQuestionType } from "@/core/enums/serviceQuestionType";

function question(overrides: Partial<ServiceQuestionnaireQuestion> = {}): ServiceQuestionnaireQuestion {
  return {
    id: "q1",
    workspace_id: "ws",
    service_version_id: "v1",
    question_text: "Any dietary restrictions?",
    question_type: "short_text",
    is_required: true,
    options: null,
    display_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

/** A tiny controlled harness so tests exercise the real onChange/onSubmit contract rather than a stubbed value. */
function Harness({ q, onSubmit }: { q: ServiceQuestionnaireQuestion; onSubmit: (value: QuestionnaireResponseValue) => void }) {
  const [value, setValue] = useState<QuestionnaireResponseValue>(emptyQuestionnaireResponseValue());
  return <QuestionnaireResponseField question={q} value={value} onChange={setValue} onSubmit={() => onSubmit(value)} />;
}

describe("QuestionnaireResponseField", () => {
  it("renders the question text as an associated label", () => {
    render(<Harness q={question()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/Any dietary restrictions\?/)).toBeInTheDocument();
  });

  it("short_text: types into a text input and submits via response_text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness q={question({ question_type: "short_text" })} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/dietary restrictions/i), "Vegetarian");
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ response_text: "Vegetarian" }));
  });

  it("long_text: renders a textarea and submits via response_text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness q={question({ question_type: "long_text", question_text: "Describe your needs" })} onSubmit={onSubmit} />);

    const field = screen.getByLabelText(/describe your needs/i);
    expect(field.tagName).toBe("TEXTAREA");
    await user.type(field, "Needs a stage riser");
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ response_text: "Needs a stage riser" }));
  });

  it("boolean: selects Yes/No and submits via response_boolean", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness q={question({ question_type: "boolean", question_text: "Need parking?" })} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("radio", { name: "Yes" }));
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ response_boolean: true }));
  });

  it("date: submits via response_date", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness q={question({ question_type: "date", question_text: "Arrival date" })} onSubmit={onSubmit} />);

    const field = screen.getByLabelText(/arrival date/i);
    await user.type(field, "2026-08-01");
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ response_date: "2026-08-01" }));
  });

  it("single_choice: selects exactly one option into response_options", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Harness
        q={question({ question_type: "single_choice", question_text: "Preferred vendor", options: ["Vendor A", "Vendor B"] })}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Vendor B" }));
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ response_options: ["Vendor B"] }));
  });

  it("multi_choice: accumulates multiple selections into response_options", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Harness
        q={question({ question_type: "multi_choice", question_text: "Dietary tags", options: ["Vegan", "Gluten-free", "Nut-free"] })}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Vegan" }));
    await user.click(screen.getByRole("checkbox", { name: "Nut-free" }));
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ response_options: ["Vegan", "Nut-free"] }));
  });

  it("never autosaves — onSubmit is not called just from typing, only from the explicit Save button", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness q={question()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/dietary restrictions/i), "Vegan");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a validation error associated with the field via aria-describedby", () => {
    render(
      <QuestionnaireResponseField
        question={question()}
        value={emptyQuestionnaireResponseValue()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        error="This answer is required."
      />,
    );
    const field = screen.getByLabelText(/dietary restrictions/i);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This answer is required.");
    expect(field).toHaveAttribute("aria-describedby", alert.id);
  });

  it("disables the field and shows a saving label while saving", () => {
    render(
      <QuestionnaireResponseField question={question()} value={emptyQuestionnaireResponseValue()} onChange={vi.fn()} onSubmit={vi.fn()} saving />,
    );
    expect(screen.getByLabelText(/dietary restrictions/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("disables the field when disabled is set", () => {
    render(
      <QuestionnaireResponseField question={question()} value={emptyQuestionnaireResponseValue()} onChange={vi.fn()} onSubmit={vi.fn()} disabled />,
    );
    expect(screen.getByLabelText(/dietary restrictions/i)).toBeDisabled();
  });

  it("throws for a question_type outside the real domain enum, rather than silently rendering nothing", () => {
    const bogus = question({ question_type: "essay" as ServiceQuestionType });
    expect(() => render(<Harness q={bogus} onSubmit={vi.fn()} />)).toThrow(/unknown question_type/i);
  });
});
