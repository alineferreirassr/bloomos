import { describe, expect, it } from "vitest";
import { validateReportFilters } from "@/core/reporting/filterEngine";

describe("core/reporting/filterEngine", () => {
  it("applies a filter the metric declares support for", () => {
    const result = validateReportFilters([{ key: "status", value: "active" }], { supportedFilters: ["status"] });
    expect(result.applied).toEqual([{ key: "status", value: "active" }]);
    expect(result.ignored).toEqual([]);
  });

  it("ignores a filter the metric doesn't declare support for", () => {
    const result = validateReportFilters([{ key: "status", value: "active" }], { supportedFilters: [] });
    expect(result.applied).toEqual([]);
    expect(result.ignored).toEqual([{ key: "status", value: "active" }]);
  });

  it("splits a mixed list into applied and ignored", () => {
    const filters = [
      { key: "status", value: "active" },
      { key: "owner", value: "member_1" },
    ] as const;
    const result = validateReportFilters([...filters], { supportedFilters: ["status"] });
    expect(result.applied.map((f) => f.key)).toEqual(["status"]);
    expect(result.ignored.map((f) => f.key)).toEqual(["owner"]);
  });

  it("returns empty applied/ignored for an empty filter list", () => {
    const result = validateReportFilters([], { supportedFilters: ["status"] });
    expect(result.applied).toEqual([]);
    expect(result.ignored).toEqual([]);
  });
});
