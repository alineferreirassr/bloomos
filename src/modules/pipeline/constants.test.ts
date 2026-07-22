import { describe, expect, it } from "vitest";
import { COMMERCIAL_COLUMNS, COMMERCIAL_PIPELINE_STATUSES, columnById, columnForStatus } from "@/modules/pipeline/constants";
import { LEAD_STATUSES } from "@/core/enums/leadStatus";

describe("columnForStatus", () => {
  it("maps new/contacted/welcome_guide_sent to the 'lead' column", () => {
    expect(columnForStatus("new")).toBe("lead");
    expect(columnForStatus("contacted")).toBe("lead");
    expect(columnForStatus("welcome_guide_sent")).toBe("lead");
  });

  it("maps every other in-progress status to its own single column", () => {
    expect(columnForStatus("qualified")).toBe("qualified");
    expect(columnForStatus("consultation_scheduled")).toBe("consultation_scheduled");
    expect(columnForStatus("proposal_sent")).toBe("proposal_sent");
    expect(columnForStatus("waiting_decision")).toBe("waiting_decision");
  });

  it("returns null for terminal statuses — they never appear on the board", () => {
    expect(columnForStatus("converted")).toBeNull();
    expect(columnForStatus("lost")).toBeNull();
    expect(columnForStatus("archived")).toBeNull();
  });

  it("covers every LeadStatus exactly once across board columns plus the three terminal exclusions", () => {
    const boarded = LEAD_STATUSES.filter((s) => columnForStatus(s) !== null);
    const excluded = LEAD_STATUSES.filter((s) => columnForStatus(s) === null);
    expect(excluded.sort()).toEqual(["archived", "converted", "lost"]);
    expect(boarded).toHaveLength(LEAD_STATUSES.length - 3);
    expect(new Set(COMMERCIAL_PIPELINE_STATUSES)).toEqual(new Set(boarded));
  });
});

describe("columnById", () => {
  it("returns the matching column definition", () => {
    expect(columnById("qualified").label).toBe("Qualified");
  });

  it("throws for an unknown id", () => {
    // @ts-expect-error deliberately invalid id to prove the guard fires
    expect(() => columnById("not_a_column")).toThrow();
  });
});

describe("COMMERCIAL_COLUMNS", () => {
  it("gives the 'booked' column no statuses and no default status — it's action-only, never a persisted Lead status", () => {
    const booked = COMMERCIAL_COLUMNS.find((c) => c.id === "booked");
    expect(booked?.statuses).toEqual([]);
    expect(booked?.defaultStatus).toBeNull();
  });

  it("gives every non-booked column a defaultStatus", () => {
    for (const column of COMMERCIAL_COLUMNS) {
      if (column.id === "booked") continue;
      expect(column.defaultStatus).not.toBeNull();
    }
  });
});
