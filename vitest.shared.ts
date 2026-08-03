import react from "@vitejs/plugin-react";
import path from "node:path";
import type { ViteUserConfig } from "vitest/config";

/**
 * The parts every Vitest config in this repo needs identically. Kept as one
 * plain object (not `defineConfig`) so both `vitest.config.ts` (full
 * thresholds, used by `test`/`test:coverage`/`test:ci`) and
 * `vitest.scoped.config.ts` (no thresholds, used by the two dev-inspection
 * "coverage for a slice" scripts) stay in lockstep on everything except
 * whether a threshold gate applies — see docs/testing.md for why those two
 * scripts need thresholds off rather than merely a lower bar.
 */
export const baseConfig: ViteUserConfig = {
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Modest, evidence-based safety margin (default is 5000ms) — see
    // docs/testing.md "Known flaky tests" for the investigation that led to
    // this. Three otherwise-simple, synchronous-or-near-synchronous tests
    // were observed missing the default timeout only under full-suite
    // parallel load, never in isolation — consistent with worker/thread
    // contention on a constrained machine, not a defect in the tests
    // themselves. This raises the ceiling rather than masking a real bug.
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/testUtils.{ts,tsx}", "src/types/**", "src/**/*.d.ts"],
    },
  },
};
