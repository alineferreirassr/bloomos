import { defineConfig } from "vitest/config";
import { baseConfig } from "./vitest.shared";

/**
 * Used only by `test:coverage:services` and `test:coverage:critical` — a
 * scoped run restricts WHICH TEST FILES execute (via a path argument), not
 * which source files coverage is measured against, so every file the
 * scoped tests don't touch reports 0% in the same run. Enforcing the
 * full-suite thresholds (`vitest.config.ts`) against that partial run would
 * fail every single time regardless of whether anything is actually wrong
 * — these two scripts are for reading a slice's own numbers, not for
 * gating the build. `test:coverage`/`test:ci` (full suite, full
 * `vitest.config.ts`) remain the only threshold-enforcing commands.
 */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    coverage: {
      ...baseConfig.test?.coverage,
    },
  },
});
