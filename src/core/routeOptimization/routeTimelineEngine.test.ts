import { describe, expect, it } from "vitest";
import { routeCreatedEvent, routeOptimizedEvent, routeValidatedEvent, routeApprovedEvent, routeArchivedEvent, optimizationRecalculatedEvent } from "@/core/routeOptimization/routeTimelineEngine";

describe("routeTimelineEngine", () => {
  it("builds a route_created event", () => {
    expect(routeCreatedEvent()).toEqual({ type: "route_created", description: "Route plan created." });
  });

  it("builds a route_optimized event including the score", () => {
    const event = routeOptimizedEvent(85);
    expect(event.type).toBe("route_optimized");
    expect(event.description).toContain("85/100");
  });

  it("builds a route_validated event", () => {
    expect(routeValidatedEvent()).toEqual({ type: "route_validated", description: "Route validated." });
  });

  it("builds a route_approved event", () => {
    expect(routeApprovedEvent()).toEqual({ type: "route_approved", description: "Route approved." });
  });

  it("builds a route_archived event", () => {
    expect(routeArchivedEvent()).toEqual({ type: "route_archived", description: "Route archived." });
  });

  it("builds an optimization_recalculated event including the score", () => {
    const event = optimizationRecalculatedEvent(60);
    expect(event.type).toBe("optimization_recalculated");
    expect(event.description).toContain("60/100");
  });
});
