import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { registerDefaultTimelineActivityTypes } from "@/core/timeline";
import type { TimelineActivity } from "@/types/timelineActivity";

function makeActivity(overrides: Partial<TimelineActivity> = {}): TimelineActivity {
  return {
    id: "activity_1",
    workspace_id: "ws_test",
    owner_type: "vendor",
    owner_id: "vendor_1",
    type: "vendor_created" as TimelineActivity["type"],
    description: "Vendor created",
    actor: "Amoré Bloom Team",
    timestamp: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("Timeline", () => {
  it("shows the default empty state when there are no activities", () => {
    render(<Timeline activities={[]} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("shows a custom empty title and description when provided", () => {
    render(<Timeline activities={[]} emptyTitle="No vendor activity" emptyDescription="Nothing recorded yet." />);
    expect(screen.getByText("No vendor activity")).toBeInTheDocument();
    expect(screen.getByText("Nothing recorded yet.")).toBeInTheDocument();
  });

  it("resolves all 5 registered Vendor activity labels through the Core registry", () => {
    registerDefaultTimelineActivityTypes();
    const labels: Record<string, string> = {
      vendor_created: "Vendor created",
      vendor_updated: "Vendor updated",
      vendor_archived: "Vendor archived",
      vendor_restored: "Vendor restored",
      vendor_preferred_status_changed: "Preferred status changed",
    };
    const activities = Object.keys(labels).map((type, index) =>
      makeActivity({ id: `activity_${index}`, type: type as TimelineActivity["type"], description: `event ${index}` }),
    );

    render(<Timeline activities={activities} />);

    for (const label of Object.values(labels)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("still resolves a pre-existing, non-Vendor activity type unchanged", () => {
    render(<Timeline activities={[makeActivity({ type: "client_created" as TimelineActivity["type"], description: "A new client record" })]} />);
    expect(screen.getByText("Client created")).toBeInTheDocument();
    expect(screen.getByText("A new client record")).toBeInTheDocument();
  });

  it("falls back to the raw type string for an unregistered activity type", () => {
    render(<Timeline activities={[makeActivity({ type: "totally_unknown_type" as TimelineActivity["type"] })]} />);
    expect(screen.getByText("totally_unknown_type")).toBeInTheDocument();
  });

  it("renders the actor and a formatted timestamp for each activity", () => {
    render(<Timeline activities={[makeActivity({ actor: "Jordan Ellis" })]} />);
    expect(screen.getByText(/Jordan Ellis/)).toBeInTheDocument();
  });
});
