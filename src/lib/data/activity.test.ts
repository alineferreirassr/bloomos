import { beforeEach, describe, expect, it } from "vitest";
import { getRecentActivity, resetAllMockData } from "@/lib/data";
import { readActivities, recordTimelineActivity, writeActivities } from "@/lib/data/mock/timelineStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { TimelineActivity } from "@/types/timelineActivity";

const OTHER_WORKSPACE_ID = "workspace_other_tenant";

beforeEach(() => {
  resetAllMockData();
});

function seedActivityAt(
  description: string,
  timestamp: string,
  overrides: Partial<TimelineActivity> = {},
): void {
  const activity: TimelineActivity = {
    id: `activity_${description}`,
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "lead",
    owner_id: "lead_1",
    type: "lead_created",
    description,
    actor: "Test Actor",
    timestamp,
    ...overrides,
  };
  writeActivities([...readActivities(), activity]);
}

describe("getRecentActivity (Booking Workflow, Phase 2 — unified activity feed)", () => {
  it("returns activities across owner types, most recent first", async () => {
    seedActivityAt("First", "2026-07-17T10:00:00.000Z", { owner_type: "lead", owner_id: "lead_1" });
    seedActivityAt("Second", "2026-07-17T11:00:00.000Z", { owner_type: "event", owner_id: "event_1" });
    seedActivityAt("Third", "2026-07-17T12:00:00.000Z", { owner_type: "client", owner_id: "client_1" });

    const ordered = await getActivityByDescription(["First", "Second", "Third"]);
    expect(ordered).toEqual(["Third", "Second", "First"]);
  });

  it("respects a custom limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      recordTimelineActivity(CURRENT_WORKSPACE_ID, "lead", `lead_${i}`, "lead_created", `Entry ${i}`);
    }

    const result = await getRecentActivity(3);
    expect(result).toHaveLength(3);
  });

  it("defaults to a limit of 20", async () => {
    for (let i = 0; i < 25; i += 1) {
      recordTimelineActivity(CURRENT_WORKSPACE_ID, "lead", `lead_${i}`, "lead_created", `Entry ${i}`);
    }

    const result = await getRecentActivity();
    expect(result).toHaveLength(20);
  });

  it("never includes activity from another workspace", async () => {
    recordTimelineActivity(OTHER_WORKSPACE_ID, "lead", "lead_foreign", "lead_created", "Foreign entry");
    recordTimelineActivity(CURRENT_WORKSPACE_ID, "lead", "lead_local", "lead_created", "Local entry");

    const result = await getRecentActivity();
    expect(result.some((activity) => activity.description === "Foreign entry")).toBe(false);
    expect(result.some((activity) => activity.description === "Local entry")).toBe(true);
  });
});

async function getActivityByDescription(descriptions: string[]): Promise<string[]> {
  const result = await getRecentActivity();
  return result.filter((a) => descriptions.includes(a.description)).map((a) => a.description);
}
