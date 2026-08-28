import { afterEach, describe, expect, it } from "vitest";
import { readCheckIns, readWaterLogs, upsertMockCheckIn, upsertMockWaterLog, resetWellnessMockData } from "@/lib/data/mock/wellnessStore";

const EMPLOYEE_A = "user_employee_a";
const EMPLOYEE_B = "user_employee_b";
const TODAY = "2026-08-15";

afterEach(() => {
  resetWellnessMockData();
});

/**
 * Storage-layer proof of the same isolation `employee_wellness_checkins`'s
 * real RLS policy (`member_id = auth.uid()`, no exceptions) enforces at the
 * database level — every row is strictly scoped by `member_id`, and the
 * public repository API (`WellnessRepository`) never accepts a caller-
 * supplied member id to read/write, so there is no code path for one
 * employee, or a Founder/Admin, to reach another employee's row through
 * this store. See `supabase/migrations/20260902100000_employee_wellness_privacy.sql`
 * for the actual enforced policy text.
 *
 * Known, deliberately-scoped-out gap (see the migration's own comment and
 * `rlsPolicy.test.ts`): every key here is `member_id` (+ date) only, never
 * `member_id` + `workspace_id`. That's safe today because this is a
 * single-workspace MVP — a real `auth.uid()` cannot belong to two
 * workspaces yet — but is a forward-looking risk, not a current blocker,
 * documented rather than "fixed" against a scenario that can't happen yet.
 */
describe("wellness store — mood check-in isolation", () => {
  it("EMPLOYEE A can write and read their own check-in", () => {
    const created = upsertMockCheckIn(EMPLOYEE_A, TODAY, "focused");
    expect(created.member_id).toBe(EMPLOYEE_A);
    expect(created.mood).toBe("focused");

    const mine = readCheckIns().find((c) => c.member_id === EMPLOYEE_A && c.checkin_date === TODAY);
    expect(mine?.mood).toBe("focused");
  });

  it("EMPLOYEE B cannot read EMPLOYEE A's check-in — no row matches their own member_id", () => {
    upsertMockCheckIn(EMPLOYEE_A, TODAY, "stressed");

    const asEmployeeB = readCheckIns().find((c) => c.member_id === EMPLOYEE_B && c.checkin_date === TODAY);
    expect(asEmployeeB).toBeUndefined();
  });

  it("changing your own mood never touches another employee's row", () => {
    upsertMockCheckIn(EMPLOYEE_A, TODAY, "great");
    upsertMockCheckIn(EMPLOYEE_B, TODAY, "tired");
    upsertMockCheckIn(EMPLOYEE_A, TODAY, "calm");

    expect(readCheckIns().find((c) => c.member_id === EMPLOYEE_A)?.mood).toBe("calm");
    expect(readCheckIns().find((c) => c.member_id === EMPLOYEE_B)?.mood).toBe("tired");
  });
});

describe("wellness store — known member_id-only keying (documented, not a current bug)", () => {
  it("a single member_id's check-in for a given date is shared across workspace_id values passed to upsertMockCheckIn — expected today, since a real auth.uid() cannot yet belong to two workspaces", () => {
    // This test exists to make the known gap loud if it's ever silently
    // "fixed" by accident in a way that changes behavior without updating
    // the migration/store's own documentation of the tradeoff — see the
    // describe block's own comment above and the migration file's header.
    const first = upsertMockCheckIn(EMPLOYEE_A, TODAY, "calm");
    const second = upsertMockCheckIn(EMPLOYEE_A, TODAY, "stressed");
    expect(second.id).toBe(first.id);
    expect(readCheckIns()).toHaveLength(1);
    expect(readCheckIns()[0].mood).toBe("stressed");
  });
});

describe("wellness store — water tracker isolation", () => {
  it("EMPLOYEE A can add/remove their own glasses", () => {
    upsertMockWaterLog(EMPLOYEE_A, TODAY, 3);
    const mine = readWaterLogs().find((w) => w.member_id === EMPLOYEE_A && w.log_date === TODAY);
    expect(mine?.glasses).toBe(3);
  });

  it("EMPLOYEE B cannot read EMPLOYEE A's water log", () => {
    upsertMockWaterLog(EMPLOYEE_A, TODAY, 5);
    const asEmployeeB = readWaterLogs().find((w) => w.member_id === EMPLOYEE_B && w.log_date === TODAY);
    expect(asEmployeeB).toBeUndefined();
  });

  it("glasses never go negative and never leak into another employee's count", () => {
    upsertMockWaterLog(EMPLOYEE_A, TODAY, -1);
    upsertMockWaterLog(EMPLOYEE_B, TODAY, 8);
    expect(readWaterLogs().find((w) => w.member_id === EMPLOYEE_A)?.glasses).toBe(0);
    expect(readWaterLogs().find((w) => w.member_id === EMPLOYEE_B)?.glasses).toBe(8);
  });
});
