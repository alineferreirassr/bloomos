import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BREAKPOINTS_PX, DURATIONS_MS, SPACING_PX } from "@/styles/designTokens";

/**
 * A drift check, not a design-value test: fails loudly if `globals.css`'s
 * duration/spacing tokens are ever changed without this file's mirror being
 * updated to match, per this module's own "globals.css wins" rule.
 */
describe("designTokens mirrors globals.css", () => {
  const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf-8");

  it("matches every --duration-*-ms value", () => {
    for (const [name, ms] of Object.entries(DURATIONS_MS)) {
      expect(css).toContain(`--duration-${name}-ms: ${ms}ms`);
    }
  });

  it("matches every --spacing-*-px value", () => {
    for (const [name, px] of Object.entries(SPACING_PX)) {
      expect(css).toContain(`--spacing-${name}-px: ${px}px`);
    }
  });

  it("exposes all 5 breakpoints in ascending order", () => {
    const keys = Object.keys(BREAKPOINTS_PX);
    const values = Object.values(BREAKPOINTS_PX);
    expect(keys).toEqual(["sm", "md", "lg", "xl", "2xl"]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});
