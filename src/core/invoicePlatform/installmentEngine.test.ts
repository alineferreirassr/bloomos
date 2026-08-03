import { describe, it, expect } from "vitest";
import { buildPaymentSchedule, sumInstallments, scheduleMatchesTotal } from "@/core/invoicePlatform/installmentEngine";

describe("buildPaymentSchedule", () => {
  it("single_payment produces one installment covering the full total", () => {
    const schedule = buildPaymentSchedule("single_payment", 65000);
    expect(schedule).toHaveLength(1);
    expect(schedule[0].amount_minor).toBe(65000);
    expect(schedule[0].kind).toBe("final_payment");
  });

  it("two_payments splits evenly and sums to the exact total", () => {
    const schedule = buildPaymentSchedule("two_payments", 10001);
    expect(schedule).toHaveLength(2);
    expect(sumInstallments(schedule)).toBe(10001);
  });

  it("three_payments splits evenly and sums to the exact total, absorbing rounding in the last row", () => {
    const schedule = buildPaymentSchedule("three_payments", 10000);
    expect(schedule).toHaveLength(3);
    expect(sumInstallments(schedule)).toBe(10000);
    expect(schedule[schedule.length - 1].kind).toBe("final_payment");
  });

  it("deposit_final applies the given deposit percent and the final payment absorbs the remainder", () => {
    const schedule = buildPaymentSchedule("deposit_final", 100000, { depositPercent: 30 });
    expect(schedule[0].kind).toBe("deposit");
    expect(schedule[0].amount_minor).toBe(30000);
    expect(schedule[1].amount_minor).toBe(70000);
  });

  it("deposit_final defaults to 30% when no depositPercent is given", () => {
    const schedule = buildPaymentSchedule("deposit_final", 100000);
    expect(schedule[0].amount_minor).toBe(30000);
  });

  it("milestone_payments builds one row per custom milestone", () => {
    const schedule = buildPaymentSchedule("milestone_payments", 30000, {
      customInstallments: [
        { label: "Booking", amount_minor: 10000, dueDate: null },
        { label: "Mid-event", amount_minor: 10000, dueDate: null },
        { label: "Completion", amount_minor: 10000, dueDate: null },
      ],
    });
    expect(schedule).toHaveLength(3);
    expect(schedule.every((i) => i.kind === "milestone" || i.kind === "final_payment")).toBe(true);
  });

  it("custom_schedule builds one row per custom installment", () => {
    const schedule = buildPaymentSchedule("custom_schedule", 5000, { customInstallments: [{ label: "Only Payment", amount_minor: 5000, dueDate: "2026-08-01" }] });
    expect(schedule).toHaveLength(1);
    expect(schedule[0].dueDate).toBe("2026-08-01");
  });
});

describe("scheduleMatchesTotal", () => {
  it("returns true when the schedule sums exactly to the grand total", () => {
    const schedule = buildPaymentSchedule("two_payments", 8000);
    expect(scheduleMatchesTotal(schedule, 8000)).toBe(true);
  });

  it("returns false when the schedule doesn't match", () => {
    const schedule = buildPaymentSchedule("single_payment", 8000);
    expect(scheduleMatchesTotal(schedule, 9000)).toBe(false);
  });
});
