import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockWorkersRepository, resetWorkersStore, type CreateWorkerInput } from "@/lib/data/mock/workersStore";

const baseInput: CreateWorkerInput = {
  first_name: "Ana",
  last_name: "Ferreira",
  email: "ana@example.com",
  phone: null,
  role: "technician",
  employment_type: "full_time",
  team_id: null,
  supervisor_worker_id: null,
  linked_member_id: null,
  time_zone: "America/Sao_Paulo",
  language: "en",
  profile_photo_url: null,
  emergency_contact: null,
  skills: [],
  certifications: [],
};

beforeEach(() => resetWorkersStore());
afterEach(() => resetWorkersStore());

describe("mockWorkersRepository", () => {
  it("creates a worker defaulting to active status and off_duty activity", async () => {
    const result = await mockWorkersRepository.createWorker("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.current_activity).toBe("off_duty");
    expect(result.data.archived_at).toBeNull();
  });

  it("rejects a blank first or last name", async () => {
    const result = await mockWorkersRepository.createWorker("ws_1", { ...baseInput, first_name: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a blank email", async () => {
    const result = await mockWorkersRepository.createWorker("ws_1", { ...baseInput, email: "" });
    expect(result.success).toBe(false);
  });

  it("lists workers scoped to the workspace, excluding archived by default", async () => {
    const created = await mockWorkersRepository.createWorker("ws_1", baseInput);
    await mockWorkersRepository.createWorker("ws_2", baseInput);
    if (created.success) await mockWorkersRepository.archiveWorker(created.data.id, "ws_1");

    expect(await mockWorkersRepository.listWorkersForWorkspace("ws_1")).toEqual([]);
    expect(await mockWorkersRepository.listWorkersForWorkspace("ws_1", true)).toHaveLength(1);
  });

  it("archiveWorker sets status to terminated and archived_at", async () => {
    const created = await mockWorkersRepository.createWorker("ws_1", baseInput);
    if (!created.success) return;
    const archived = await mockWorkersRepository.archiveWorker(created.data.id, "ws_1");
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.status).toBe("terminated");
      expect(archived.data.archived_at).not.toBeNull();
    }
  });

  it("restoreWorker clears archived_at and resets status to active", async () => {
    const created = await mockWorkersRepository.createWorker("ws_1", baseInput);
    if (!created.success) return;
    await mockWorkersRepository.archiveWorker(created.data.id, "ws_1");
    const restored = await mockWorkersRepository.restoreWorker(created.data.id, "ws_1");
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("active");
      expect(restored.data.archived_at).toBeNull();
    }
  });

  it("fails to update a worker belonging to a different workspace", async () => {
    const created = await mockWorkersRepository.createWorker("ws_1", baseInput);
    if (!created.success) return;
    const result = await mockWorkersRepository.updateWorker(created.data.id, "ws_2", { first_name: "Renamed" });
    expect(result.success).toBe(false);
  });

  it("setWorkerCurrentActivity updates only the current_activity field", async () => {
    const created = await mockWorkersRepository.createWorker("ws_1", baseInput);
    if (!created.success) return;
    const updated = await mockWorkersRepository.setWorkerCurrentActivity(created.data.id, "ws_1", "on_site");
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.current_activity).toBe("on_site");
      expect(updated.data.status).toBe("active");
    }
  });
});
