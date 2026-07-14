const isTestEnv = process.env.NODE_ENV === "test";

/** Small artificial delay so mock reads have a visible loading state in the browser; skipped in tests. */
export function delay(ms: number): Promise<void> {
  if (isTestEnv) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
