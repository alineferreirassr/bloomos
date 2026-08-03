import { generateId, nowIso } from "@/lib/data/utils";
import type { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";

/**
 * The real Stripe API Call Log (v2 Checkpoint 23, Step 18 — "API Calls").
 * Every entry reflects a genuine `StripeProvider` method invocation —
 * never fabricated counts. Rate limit tracking is deliberately *not*
 * implemented: Stripe only surfaces rate-limit headers through its raw
 * HTTP response, which the typed SDK methods this provider uses don't
 * expose without extra plumbing this checkpoint doesn't add — see
 * `docs/stripe-provider.md`'s own Known Limitations rather than a
 * fabricated number here.
 */
export interface StripeApiCallLogEntry {
  id: string;
  workspaceId: string;
  method: string;
  occurredAt: string;
  durationMs: number;
  success: boolean;
  error: string | null;
}

let entries: StripeApiCallLogEntry[] = [];
const MAX_ENTRIES_PER_WORKSPACE = 200;

export function resetStripeApiCallLog(): void {
  entries = [];
}

function recordCall(workspaceId: string, method: string, durationMs: number, success: boolean, error: string | null): void {
  entries = [...entries, { id: generateId("stripe-api-call"), workspaceId, method, occurredAt: nowIso(), durationMs, success, error }];
  const forWorkspace = entries.filter((entry) => entry.workspaceId === workspaceId);
  if (forWorkspace.length > MAX_ENTRIES_PER_WORKSPACE) {
    const excess = forWorkspace.slice(0, forWorkspace.length - MAX_ENTRIES_PER_WORKSPACE).map((entry) => entry.id);
    entries = entries.filter((entry) => !excess.includes(entry.id));
  }
}

export function listStripeApiCallsForWorkspace(workspaceId: string, limit = 50): StripeApiCallLogEntry[] {
  return entries
    .filter((entry) => entry.workspaceId === workspaceId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

/**
 * Wraps a real `StripeProvider` instance in a `Proxy` that logs every
 * method call — transparent to the caller, no change to `StripeProvider`
 * itself. Only async methods (every real Stripe-calling method on this
 * class) are logged; `ping`/`verifyInboundSignature`/`mapInboundEvent`
 * are excluded since diagnostics care about real outbound API traffic,
 * not the connectivity check or the pure signature-verification path.
 */
export function withApiCallLogging(workspaceId: string, provider: StripeProvider): StripeProvider {
  const EXCLUDED_METHODS = new Set(["verifyInboundSignature", "mapInboundEvent", "constructVerifiedEvent"]);
  return new Proxy(provider, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function" || typeof prop !== "string" || EXCLUDED_METHODS.has(prop)) return value;

      return async (...args: unknown[]) => {
        const startedAt = Date.now();
        try {
          const result = await (value as (...fnArgs: unknown[]) => unknown).apply(target, args);
          recordCall(workspaceId, prop, Date.now() - startedAt, true, null);
          return result;
        } catch (error) {
          recordCall(workspaceId, prop, Date.now() - startedAt, false, error instanceof Error ? error.message : "Unknown error");
          throw error;
        }
      };
    },
  });
}
