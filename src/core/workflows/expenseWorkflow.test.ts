import { describe, expect, it } from "vitest";
import {
  canTransitionExpenseStatus,
  getNextExpenseStatuses,
  isExpenseTerminal,
  getExpenseNextRecommendedAction,
} from "@/core/workflows/expenseWorkflow";

describe("canTransitionExpenseStatus", () => {
  it("allows planned -> approved, cancelled, archived", () => {
    for (const to of ["approved", "cancelled", "archived"] as const) {
      expect(canTransitionExpenseStatus("planned", to)).toBe(true);
    }
  });

  it("allows approved -> due, paid, cancelled, archived", () => {
    for (const to of ["due", "paid", "cancelled", "archived"] as const) {
      expect(canTransitionExpenseStatus("approved", to)).toBe(true);
    }
  });

  it("disallows planned -> due directly (must be approved first)", () => {
    expect(canTransitionExpenseStatus("planned", "due")).toBe(false);
  });

  it("allows paid -> reimbursed, archived", () => {
    expect(canTransitionExpenseStatus("paid", "reimbursed")).toBe(true);
    expect(canTransitionExpenseStatus("paid", "archived")).toBe(true);
  });

  it("disallows paid -> cancelled (a paid expense can't be cancelled)", () => {
    expect(canTransitionExpenseStatus("paid", "cancelled")).toBe(false);
  });

  it("allows archived -> planned (restore)", () => {
    expect(canTransitionExpenseStatus("archived", "planned")).toBe(true);
  });

  it("disallows a status transitioning to itself", () => {
    expect(canTransitionExpenseStatus("planned", "planned")).toBe(false);
  });
});

describe("getNextExpenseStatuses", () => {
  it("returns the full transition set for planned", () => {
    expect(getNextExpenseStatuses("planned")).toEqual(["approved", "cancelled", "archived"]);
  });
});

describe("isExpenseTerminal", () => {
  it("is true for reimbursed, cancelled, archived", () => {
    expect(isExpenseTerminal("reimbursed")).toBe(true);
    expect(isExpenseTerminal("cancelled")).toBe(true);
    expect(isExpenseTerminal("archived")).toBe(true);
  });

  it("is false for planned/approved/due/paid", () => {
    for (const status of ["planned", "approved", "due", "paid"] as const) {
      expect(isExpenseTerminal(status)).toBe(false);
    }
  });
});

describe("getExpenseNextRecommendedAction", () => {
  it("returns null for a terminal status", () => {
    expect(
      getExpenseNextRecommendedAction({ status: "archived", due_date: null, reimbursable: false, reimbursed_at: null }),
    ).toBeNull();
  });

  it("recommends reviewing a planned expense", () => {
    expect(
      getExpenseNextRecommendedAction({ status: "planned", due_date: null, reimbursable: false, reimbursed_at: null }),
    ).toMatch(/review and approve/i);
  });

  it("flags an overdue approved expense", () => {
    const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(
      getExpenseNextRecommendedAction({ status: "approved", due_date: pastDue, reimbursable: false, reimbursed_at: null }),
    ).toMatch(/overdue/i);
  });

  it("flags a due-soon due expense", () => {
    const dueSoon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(
      getExpenseNextRecommendedAction({ status: "due", due_date: dueSoon, reimbursable: false, reimbursed_at: null }),
    ).toMatch(/due soon/i);
  });

  it("recommends reimbursing a paid, reimbursable, not-yet-reimbursed expense", () => {
    expect(
      getExpenseNextRecommendedAction({ status: "paid", due_date: null, reimbursable: true, reimbursed_at: null }),
    ).toMatch(/reimburse/i);
  });

  it("returns null for a paid, non-reimbursable expense", () => {
    expect(
      getExpenseNextRecommendedAction({ status: "paid", due_date: null, reimbursable: false, reimbursed_at: null }),
    ).toBeNull();
  });

  it("returns null for a paid expense already reimbursed", () => {
    expect(
      getExpenseNextRecommendedAction({
        status: "paid",
        due_date: null,
        reimbursable: true,
        reimbursed_at: "2026-01-01T00:00:00.000Z",
      }),
    ).toBeNull();
  });
});
