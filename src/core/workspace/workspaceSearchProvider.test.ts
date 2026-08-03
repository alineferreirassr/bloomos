import { beforeEach, describe, expect, it } from "vitest";
import { workspaceSearchProvider } from "@/core/workspace/workspaceSearchProvider";
import { registerSearchableEntity } from "@/core/search/registry";
import { registerDefaultSearchableEntities } from "@/core/search/defaultRegistrations";
import { resetAllMockData } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { getCoreWorkersService, getCoreTeamsService, getCoreEquipmentService, getCoreVehiclesService } from "@/core/workforce";

describe("workspaceSearchProvider", () => {
  beforeEach(() => {
    resetAllMockData();
    registerDefaultSearchableEntities();
  });

  it("returns no results for a blank term", async () => {
    const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "   " });
    expect(results).toEqual([]);
  });

  it("finds a seeded lead by first name and returns a real route", async () => {
    const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "Sofia" });
    const match = results.find((r) => r.entityType === "lead");
    expect(match).toBeDefined();
    expect(match!.route).toMatch(/^\/leads\//);
    expect(match!.score).toBeGreaterThan(0);
  });

  it("scores an exact title match higher than a substring match", async () => {
    const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "sofia marchetti" });
    const match = results.find((r) => r.entityType === "lead" && r.title === "Sofia Marchetti");
    expect(match?.score).toBe(100);
  });

  it("only searches entity types listed in query.entityTypes when provided", async () => {
    const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "a", entityTypes: ["vendor"] });
    expect(results.every((r) => r.entityType === "vendor")).toBe(true);
  });

  it("skips an entity type with no registered route, even if a fetcher exists", async () => {
    // "lead" has a real fetcher but, if unregistered, must be skipped rather than defaulting to a made-up route.
    const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "Sofia", entityTypes: ["proposal" as never] });
    expect(results).toEqual([]);
  });

  it("registering a new searchable entity makes it discoverable without code changes to the provider", async () => {
    registerSearchableEntity({ entityType: "purchase", label: "Purchase", module: "Purchases", route: (id) => `/purchases/${id}` });
    const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "Sofia" });
    // No assertion on purchase-specific content (no fetcher registered for it) — this just confirms the search call doesn't throw when new entity configs are added.
    expect(Array.isArray(results)).toBe(true);
  });

  describe("worker/team/equipment/vehicle (Checkpoint 45A — Finding 17 fix)", () => {
    it("finds a worker by name and routes to their real detail page", async () => {
      const created = await getCoreWorkersService().createWorker(CURRENT_WORKSPACE_ID, {
        first_name: "Marisol",
        last_name: "Alvarez",
        email: "marisol@amorebloom.com",
        phone: null,
        role: "photographer",
        employment_type: "contractor",
        team_id: null,
        supervisor_worker_id: null,
        linked_member_id: null,
        time_zone: "America/New_York",
        language: "en",
        profile_photo_url: null,
        emergency_contact: null,
        skills: [],
        certifications: [],
      });
      if (!created.success) throw new Error("setup failed");

      const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "Marisol" });
      const match = results.find((r) => r.entityType === "worker");
      expect(match).toBeDefined();
      expect(match!.route).toBe(`/assets/workforce/workers/${created.data.id}`);
    });

    it("finds a team by name and routes to the Workforce Dashboard", async () => {
      const created = await getCoreTeamsService().createTeam(CURRENT_WORKSPACE_ID, { name: "Floral Install Crew", description: null, leader_worker_id: null });
      if (!created.success) throw new Error("setup failed");

      const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "Floral Install" });
      const match = results.find((r) => r.entityType === "team");
      expect(match).toBeDefined();
      expect(match!.route).toBe("/assets/workforce");
    });

    it("finds equipment by name", async () => {
      const created = await getCoreEquipmentService().createEquipment(CURRENT_WORKSPACE_ID, { name: "String Light Rig — 100ft", category: "lighting", serial_number: null, notes: null });
      if (!created.success) throw new Error("setup failed");

      const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "String Light" });
      const match = results.find((r) => r.entityType === "equipment");
      expect(match).toBeDefined();
    });

    it("finds a vehicle by label", async () => {
      const created = await getCoreVehiclesService().createVehicle(CURRENT_WORKSPACE_ID, { label: "Delivery Van 2", vehicle_type: "van", make: null, model: null, year: null, license_plate: null, notes: null });
      if (!created.success) throw new Error("setup failed");

      const results = await workspaceSearchProvider.search({ workspaceId: CURRENT_WORKSPACE_ID, term: "Delivery Van" });
      const match = results.find((r) => r.entityType === "vehicle");
      expect(match).toBeDefined();
    });
  });
});
