import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateProgressSection } from "@/modules/services/components/TemplateProgressSection";
import type { ChecklistItem } from "@/types/checklistItem";

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "item_1",
    workspace_id: "ws",
    owner_type: "event",
    owner_id: "event_1",
    title: "Confirm florals",
    description: null,
    category: "flowers",
    priority: "normal",
    status: "pending",
    due_date: null,
    completed_at: null,
    assigned_type: "unknown",
    assigned_id: null,
    assigned_name: null,
    sort_order: 0,
    source_event_service_id: "es_1",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("TemplateProgressSection", () => {
  it("computes overall completion counting completed and cancelled (skipped) as resolved", () => {
    const items = [
      item({ id: "i1", status: "completed" }),
      item({ id: "i2", status: "cancelled" }),
      item({ id: "i3", status: "pending" }),
      item({ id: "i4", status: "in_progress" }),
    ];
    render(<TemplateProgressSection checklistItems={items} />);
    expect(screen.getByText("Remaining").nextElementSibling).toHaveTextContent("2");
  });

  it("counts blocked items separately from remaining", () => {
    const items = [item({ id: "i1", status: "blocked" }), item({ id: "i2", status: "pending" })];
    render(<TemplateProgressSection checklistItems={items} />);
    expect(screen.getByText("Blocked").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Remaining").nextElementSibling).toHaveTextContent("2");
  });

  it("groups category completion by category, one row per distinct category", () => {
    const items = [
      item({ id: "i1", category: "flowers", status: "completed" }),
      item({ id: "i2", category: "flowers", status: "pending" }),
      item({ id: "i3", category: "venue", status: "completed" }),
    ];
    render(<TemplateProgressSection checklistItems={items} />);
    expect(screen.getByText("Flowers")).toBeInTheDocument();
    expect(screen.getByText("Venue")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
  });

  it("estimates completion as the latest due date among still-pending items, never a fabricated duration", () => {
    const items = [
      item({ id: "i1", status: "pending", due_date: "2026-03-01" }),
      item({ id: "i2", status: "pending", due_date: "2026-05-01" }),
      item({ id: "i3", status: "completed", due_date: "2026-12-01" }),
    ];
    render(<TemplateProgressSection checklistItems={items} />);
    expect(screen.getByText("Estimated completion").nextElementSibling).toHaveTextContent(new Date("2026-05-01").toLocaleDateString());
  });

  it("shows a dash for estimated completion when no remaining item has a due date", () => {
    render(<TemplateProgressSection checklistItems={[item({ status: "pending", due_date: null })]} />);
    expect(screen.getByText("Estimated completion").nextElementSibling).toHaveTextContent("—");
  });

  it("renders 0% overall completion with no crash when there are no checklist items", () => {
    render(<TemplateProgressSection checklistItems={[]} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
