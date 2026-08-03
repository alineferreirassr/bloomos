/**
 * Dependency inversion for metrics — the interface a real monitoring
 * backend (Datadog, Grafana Cloud, a hosted Postgres metrics sink)
 * implements later. No implementation exists yet, same "interface first"
 * scope as `errorReporting.ts`.
 */
export interface MonitoringProvider {
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
}

/** Discards the metric — never throws, never blocks the caller, since recording a metric must never be able to break the feature that triggered it. */
export const noopMonitoringProvider: MonitoringProvider = {
  recordMetric() {
    // Intentionally no-op until a real MonitoringProvider registers.
  },
};

let activeProvider: MonitoringProvider = noopMonitoringProvider;

export function setMonitoringProvider(provider: MonitoringProvider): void {
  activeProvider = provider;
}

export function getMonitoringProvider(): MonitoringProvider {
  return activeProvider;
}
