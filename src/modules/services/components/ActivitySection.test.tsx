import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivitySection } from "@/modules/services/components/ActivitySection";
import type { TimelineActivity } from "@/types/timelineActivity";

function activity(overrides: Partial<TimelineActivity> = {}): TimelineActivity {
  return {
    id: "activity_1",
    workspace_id: "ws",
    owner_type: "event_service",
    owner_id: "es_1",
    type: "status_changed",
    description: "Status changed to confirmed",
    actor: "owner",
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ActivitySection", () => {
  it("shows an empty state when there is no activity", () => {
    render(<ActivitySection activities={[]} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("shows the most recent activities first", () => {
    render(
      <ActivitySection
        activities={[
          activity({ id: "a1", timestamp: "2026-01-01T00:00:00.000Z" }),
          activity({ id: "a2", timestamp: "2026-03-01T00:00:00.000Z" }),
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("owner");
  });

  it("limits to the requested number of most recent activities", () => {
    const activities = Array.from({ length: 8 }, (_, i) => activity({ id: `a${i}`, timestamp: `2026-01-0${(i % 9) + 1}T00:00:00.000Z` }));
    render(<ActivitySection activities={activities} limit={3} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
