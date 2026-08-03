import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceVersionSection } from "@/modules/services/components/ServiceVersionSection";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { ChecklistItem } from "@/types/checklistItem";

function version(overrides: Partial<ServiceVersion> = {}): ServiceVersion {
  return {
    id: "version_1",
    service_id: "service_1",
    workspace_id: "ws",
    version_number: 2,
    status: "published",
    name_snapshot: "Photography",
    description_snapshot: null,
    base_price_minor: 150000,
    currency: "USD",
    setup_duration_minutes: 30,
    breakdown_duration_minutes: 15,
    difficulty_score: null,
    experience_level_required: "expert",
    weather_sensitivity: "none",
    surprise_friendly: false,
    estimated_profit_minor: null,
    change_summary: null,
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "owner",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "item_1",
    workspace_id: "ws",
    owner_type: "event",
    owner_id: "event_1",
    title: "Item",
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

describe("ServiceVersionSection", () => {
  it("renders the published version number, price, and metadata", () => {
    render(<ServiceVersionSection version={version()} checklistItems={[]} />);
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
    expect(screen.getByText("30 min / 15 min")).toBeInTheDocument();
  });

  it("shows a real 'Draft' badge if a version somehow isn't published, rather than always claiming Published", () => {
    render(<ServiceVersionSection version={version({ status: "draft", version_number: null })} checklistItems={[]} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows the template completion snapshot from the real generated checklist, not a fabricated number", () => {
    render(<ServiceVersionSection version={version()} checklistItems={[item({ id: "i1", status: "completed" }), item({ id: "i2", status: "pending" })]} />);
    expect(screen.getByText("1 of 2 items completed")).toBeInTheDocument();
  });

  it("says there are no generated checklist items when none exist", () => {
    render(<ServiceVersionSection version={version()} checklistItems={[]} />);
    expect(screen.getByText("No generated checklist items")).toBeInTheDocument();
  });
});
