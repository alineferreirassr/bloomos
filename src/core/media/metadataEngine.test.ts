import { describe, expect, it } from "vitest";
import { computeAspectRatio, computeOrientation } from "@/core/media/metadataEngine";

describe("computeAspectRatio", () => {
  it("reduces to a simplified ratio", () => {
    expect(computeAspectRatio({ width: 1920, height: 1080 })).toBe("16:9");
    expect(computeAspectRatio({ width: 1000, height: 1000 })).toBe("1:1");
  });

  it("returns null when a dimension is missing", () => {
    expect(computeAspectRatio({ width: null, height: 1080 })).toBeNull();
    expect(computeAspectRatio({ width: 1920, height: null })).toBeNull();
  });
});

describe("computeOrientation", () => {
  it("classifies landscape, portrait, and square", () => {
    expect(computeOrientation({ width: 1920, height: 1080 })).toBe("landscape");
    expect(computeOrientation({ width: 1080, height: 1920 })).toBe("portrait");
    expect(computeOrientation({ width: 500, height: 500 })).toBe("square");
  });

  it("returns null when a dimension is missing", () => {
    expect(computeOrientation({ width: null, height: null })).toBeNull();
  });
});
