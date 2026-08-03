import { describe, expect, it } from "vitest";
import { canTransition, listValidEventsFrom } from "@/core/integrations/connectionStateMachine";

describe("canTransition", () => {
  it("allows connect_requested from disconnected, moving to connecting", () => {
    const result = canTransition("disconnected", "connect_requested");
    expect(result).toEqual({ allowed: true, nextState: "connecting", reason: null });
  });

  it("rejects an event that isn't valid from the current state", () => {
    const result = canTransition("disconnected", "connect_succeeded");
    expect(result.allowed).toBe(false);
    expect(result.nextState).toBeNull();
    expect(result.reason).toMatch(/not valid from state/);
  });

  it("walks a full lifecycle: connect, expire, refresh, disable, re-enable", () => {
    expect(canTransition("disconnected", "connect_requested").nextState).toBe("connecting");
    expect(canTransition("connecting", "connect_succeeded").nextState).toBe("connected");
    expect(canTransition("connected", "token_expired").nextState).toBe("expired");
    expect(canTransition("expired", "refresh_requested").nextState).toBe("refreshing");
    expect(canTransition("refreshing", "refresh_succeeded").nextState).toBe("connected");
    expect(canTransition("connected", "disable_requested").nextState).toBe("disabled");
    expect(canTransition("disabled", "enable_requested").nextState).toBe("disconnected");
  });
});

describe("listValidEventsFrom", () => {
  it("returns only events reachable from the given state", () => {
    const events = listValidEventsFrom("connected");
    expect(events).toContain("token_expired");
    expect(events).toContain("disable_requested");
    expect(events).not.toContain("connect_succeeded");
  });
});
