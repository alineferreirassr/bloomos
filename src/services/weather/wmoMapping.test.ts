import { describe, expect, it } from "vitest";
import { baseConditionFromWmoCode, classifyCondition, WINDY_THRESHOLD_MPH } from "@/services/weather/wmoMapping";

describe("baseConditionFromWmoCode", () => {
  it("maps clear codes to SUNNY by day and NIGHT_CLEAR by night", () => {
    expect(baseConditionFromWmoCode(0, true)).toBe("SUNNY");
    expect(baseConditionFromWmoCode(1, true)).toBe("SUNNY");
    expect(baseConditionFromWmoCode(0, false)).toBe("NIGHT_CLEAR");
    expect(baseConditionFromWmoCode(1, false)).toBe("NIGHT_CLEAR");
  });

  it("maps every documented WMO code exactly per the founder's table", () => {
    const table: [number, ReturnType<typeof baseConditionFromWmoCode>][] = [
      [2, "PARTLY_CLOUDY"],
      [3, "CLOUDY"],
      [45, "FOG_MIST"],
      [48, "FOG_MIST"],
      [51, "LIGHT_RAIN_DRIZZLE"],
      [53, "LIGHT_RAIN_DRIZZLE"],
      [55, "LIGHT_RAIN_DRIZZLE"],
      [56, "LIGHT_RAIN_DRIZZLE"],
      [57, "LIGHT_RAIN_DRIZZLE"],
      [61, "RAIN"],
      [63, "RAIN"],
      [65, "RAIN"],
      [66, "RAIN"],
      [67, "RAIN"],
      [80, "RAIN"],
      [81, "RAIN"],
      [82, "THUNDERSTORM"],
      [71, "SNOW"],
      [73, "SNOW"],
      [75, "SNOW"],
      [77, "SNOW"],
      [85, "SNOW"],
      [86, "SNOW"],
      [95, "THUNDERSTORM"],
      [96, "THUNDERSTORM"],
      [99, "THUNDERSTORM"],
    ];
    for (const [code, expected] of table) {
      expect(baseConditionFromWmoCode(code, true)).toBe(expected);
    }
  });

  it("falls back to CLOUDY for an unmapped WMO code rather than throwing", () => {
    expect(baseConditionFromWmoCode(9999, true)).toBe("CLOUDY");
  });
});

describe("classifyCondition (WINDY precedence)", () => {
  it("overrides SUNNY/PARTLY_CLOUDY/CLOUDY/NIGHT_CLEAR with WINDY at or above the threshold", () => {
    expect(classifyCondition(0, true, WINDY_THRESHOLD_MPH)).toBe("WINDY");
    expect(classifyCondition(2, true, WINDY_THRESHOLD_MPH)).toBe("WINDY");
    expect(classifyCondition(3, true, WINDY_THRESHOLD_MPH)).toBe("WINDY");
    expect(classifyCondition(0, false, WINDY_THRESHOLD_MPH)).toBe("WINDY");
  });

  it("does not override below the threshold", () => {
    expect(classifyCondition(0, true, WINDY_THRESHOLD_MPH - 1)).toBe("SUNNY");
  });

  it("never overrides operationally significant conditions (rain/drizzle/thunderstorm/snow/fog) even at very high wind speeds", () => {
    expect(classifyCondition(61, true, 60)).toBe("RAIN");
    expect(classifyCondition(51, true, 60)).toBe("LIGHT_RAIN_DRIZZLE");
    expect(classifyCondition(95, true, 60)).toBe("THUNDERSTORM");
    expect(classifyCondition(71, true, 60)).toBe("SNOW");
    expect(classifyCondition(45, true, 60)).toBe("FOG_MIST");
  });

  it("classifies calm weather normally with zero wind", () => {
    expect(classifyCondition(0, true, 0)).toBe("SUNNY");
  });
});
