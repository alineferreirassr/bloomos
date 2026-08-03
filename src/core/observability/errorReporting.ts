import { getLogger } from "@/core/observability/logger";

/**
 * Dependency inversion for crash/exception reporting — the interface a
 * real Sentry (or equivalent) adapter implements and registers later. No
 * implementation exists yet, matching this checkpoint's "interface, not a
 * live integration" scope for every Observability piece.
 */
export interface ErrorReportingProvider {
  captureException(error: unknown, context?: Record<string, unknown>): void;
}

/** Logs through `getLogger()` rather than doing nothing — an unconfigured error reporter should never make an exception silently vanish. */
export const noopErrorReportingProvider: ErrorReportingProvider = {
  captureException(error, context) {
    getLogger().error("Unreported exception (no ErrorReportingProvider registered)", {
      error: error instanceof Error ? error.message : String(error),
      ...context,
    });
  },
};

let activeProvider: ErrorReportingProvider = noopErrorReportingProvider;

export function setErrorReportingProvider(provider: ErrorReportingProvider): void {
  activeProvider = provider;
}

export function getErrorReportingProvider(): ErrorReportingProvider {
  return activeProvider;
}
