export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

/**
 * A structured logging seam — the interface a real aggregator (Datadog,
 * Better Stack, a hosted Postgres sink) implements later. Every call site
 * in the app should go through `getLogger()`, never `console.*` directly,
 * so swapping the destination is a `setLogger` call, not a grep-and-replace.
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

/**
 * The default logger — emits one JSON line per call (not a pretty-printed
 * string) so it's already shaped for a log aggregator to ingest the
 * moment one is wired up, even though today it only reaches the console.
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  const line = JSON.stringify({ level, message, context, timestamp: new Date().toISOString() });
  const consoleMethod = level === "debug" ? "debug" : level === "info" ? "log" : level;
  console[consoleMethod](line);
}

export const consoleLogger: Logger = {
  debug: (message, context) => log("debug", message, context),
  info: (message, context) => log("info", message, context),
  warn: (message, context) => log("warn", message, context),
  error: (message, context) => log("error", message, context),
};

let activeLogger: Logger = consoleLogger;

export function setLogger(logger: Logger): void {
  activeLogger = logger;
}

export function getLogger(): Logger {
  return activeLogger;
}
