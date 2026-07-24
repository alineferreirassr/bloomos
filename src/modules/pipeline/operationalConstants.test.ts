import { describe, expect, it } from "vitest";
import { EVENT_LIFECYCLE_STAGES } from "@/core/enums/eventLifecycleStage";
import { OPERATIONAL_COLUMNS, columnById } from "@/modules/pipeline/operationalConstants";

describe("OPERATIONAL_COLUMNS", () => {
  it("has exactly one column per canonical lifecycle stage, in stage order, with no bucketing", () => {
    expect(OPERATIONAL_COLUMNS.map((c) => c.id)).toEqual(EVENT_LIFECYCLE_STAGES);
  });

  it("labels every column with its human-readable lifecycle stage label", () => {
    const closed = OPERATIONAL_COLUMNS.find((c) => c.id === "closed");
    expect(closed?.label).toBe("Closed");
    const liveEvent = OPERATIONAL_COLUMNS.find((c) => c.id === "live_event");
    expect(liveEvent?.label).toBe("Live Event");
  });
});

describe("columnById", () => {
  it("returns the matching column definition", () => {
    expect(columnById("planning").label).toBe("Planning");
  });

  it("throws for an unknown id", () => {
    // @ts-expect-error deliberately invalid id to prove the guard fires
    expect(() => columnById("not_a_stage")).toThrow();
  });
});
