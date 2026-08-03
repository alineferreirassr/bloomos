import { describe, expect, it, vi, beforeEach } from "vitest";
import { consoleLogger, getLogger, setLogger } from "@/core/observability/logger";
import { noopErrorReportingProvider, getErrorReportingProvider, setErrorReportingProvider } from "@/core/observability/errorReporting";
import { noopMonitoringProvider, getMonitoringProvider, setMonitoringProvider } from "@/core/observability/monitoring";
import type { Logger } from "@/core/observability/logger";
import type { ErrorReportingProvider } from "@/core/observability/errorReporting";
import type { MonitoringProvider } from "@/core/observability/monitoring";

describe("logger", () => {
  beforeEach(() => {
    setLogger(consoleLogger);
  });

  it("defaults to the console logger", () => {
    expect(getLogger()).toBe(consoleLogger);
  });

  it("emits one JSON line per call, with level/message/context/timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleLogger.info("Something happened", { userId: "u_1" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "info", message: "Something happened", context: { userId: "u_1" } });
    expect(typeof parsed.timestamp).toBe("string");
    spy.mockRestore();
  });

  it("allows swapping in a real logger without any caller changing", () => {
    const stubLogger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    setLogger(stubLogger);
    getLogger().info("hi");
    expect(stubLogger.info).toHaveBeenCalledWith("hi");
  });
});

describe("error reporting provider", () => {
  beforeEach(() => {
    setErrorReportingProvider(noopErrorReportingProvider);
    setLogger(consoleLogger); // the noop provider logs through getLogger() — an earlier suite may have swapped in a stub logger and not restored it.
  });

  it("defaults to the noop provider, which logs rather than swallowing the exception silently", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getErrorReportingProvider().captureException(new Error("boom"));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.context.error).toBe("boom");
    errorSpy.mockRestore();
  });

  it("allows swapping in a real provider without any caller changing", () => {
    const stubProvider: ErrorReportingProvider = { captureException: vi.fn() };
    setErrorReportingProvider(stubProvider);
    getErrorReportingProvider().captureException("boom");
    expect(stubProvider.captureException).toHaveBeenCalledWith("boom");
  });
});

describe("monitoring provider", () => {
  beforeEach(() => {
    setMonitoringProvider(noopMonitoringProvider);
  });

  it("defaults to the noop provider, which never throws", () => {
    expect(() => getMonitoringProvider().recordMetric("test.metric", 1)).not.toThrow();
  });

  it("allows swapping in a real provider without any caller changing", () => {
    const stubProvider: MonitoringProvider = { recordMetric: vi.fn() };
    setMonitoringProvider(stubProvider);
    getMonitoringProvider().recordMetric("test.metric", 42, { env: "test" });
    expect(stubProvider.recordMetric).toHaveBeenCalledWith("test.metric", 42, { env: "test" });
  });
});
