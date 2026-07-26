import { defineConfig } from "vitest/config";
import { baseConfig } from "./vitest.shared";

// Measured baseline (24 Jul 2026, full suite, v8 provider):
//   repo-wide         — statements 72.45% · branches 62.85% · functions 72.77% · lines 74.64%
//   modules/services  — statements 80.92% · branches 78.14% · functions 69.17% · lines 81.78%
// Thresholds below sit a conservative 3-6 points under those measured
// numbers — enough margin to absorb normal test-to-test variance without
// flapping, tight enough that a real regression (a change that actually
// deletes or stops exercising a meaningful slice of code) still fails the
// build. See docs/testing.md for the full reasoning and the plan for
// raising these over time.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    coverage: {
      ...baseConfig.test?.coverage,
      thresholds: {
        statements: 70,
        branches: 58,
        functions: 68,
        lines: 72,
        "src/modules/services/**": {
          statements: 76,
          branches: 72,
          functions: 64,
          lines: 76,
        },
      },
    },
  },
});
