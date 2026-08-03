import { describe, expect, it } from "vitest";
import { getEventFinancialStatus, type EventFinancialStatusInput } from "@/modules/finance/eventFinancialStatus";

const base: EventFinancialStatusInput = {
  eventCancelled: false,
  hasActiveContract: true,
  hasInvoice: false,
  hasOverdueInvoice: false,
  depositRequired: false,
  depositRequiredMinor: 0,
  depositPaidMinor: 0,
  invoicedTotalMinor: 0,
  outstandingMinor: 0,
  refundedMinor: 0,
};

describe("getEventFinancialStatus", () => {
  it("returns cancelled when the Event itself is cancelled, regardless of everything else", () => {
    expect(getEventFinancialStatus({ ...base, eventCancelled: true, invoicedTotalMinor: 100000, outstandingMinor: 0 })).toBe(
      "cancelled",
    );
  });

  it("returns no_contract when there's no active Contract", () => {
    expect(getEventFinancialStatus({ ...base, hasActiveContract: false })).toBe("no_contract");
  });

  it("returns overdue when any non-voided Invoice is overdue", () => {
    expect(getEventFinancialStatus({ ...base, hasOverdueInvoice: true })).toBe("overdue");
  });

  it("returns awaiting_deposit when a deposit is required and none has been paid", () => {
    expect(
      getEventFinancialStatus({ ...base, depositRequired: true, depositRequiredMinor: 50000, depositPaidMinor: 0 }),
    ).toBe("awaiting_deposit");
  });

  it("returns deposit_partial when the deposit is partially paid", () => {
    expect(
      getEventFinancialStatus({ ...base, depositRequired: true, depositRequiredMinor: 50000, depositPaidMinor: 20000 }),
    ).toBe("deposit_partial");
  });

  it("returns paid_in_full when invoiced and nothing is outstanding", () => {
    expect(getEventFinancialStatus({ ...base, invoicedTotalMinor: 100000, outstandingMinor: 0 })).toBe("paid_in_full");
  });

  it("returns refunded when a refund occurred and nothing is currently outstanding", () => {
    expect(
      getEventFinancialStatus({ ...base, invoicedTotalMinor: 100000, outstandingMinor: 0, refundedMinor: 20000 }),
    ).toBe("refunded");
  });

  it("returns deposit_paid when the deposit is fully covered but a balance remains and nothing is overdue", () => {
    expect(
      getEventFinancialStatus({
        ...base,
        depositRequired: true,
        depositRequiredMinor: 50000,
        depositPaidMinor: 50000,
        outstandingMinor: 40000,
      }),
    ).toBe("deposit_paid");
  });

  it("returns balance_due when there's an outstanding balance and no deposit is required", () => {
    expect(getEventFinancialStatus({ ...base, outstandingMinor: 40000 })).toBe("balance_due");
  });

  it("returns awaiting_invoice as the fallback for an active Contract with no invoice yet and no deposit required", () => {
    expect(getEventFinancialStatus({ ...base })).toBe("awaiting_invoice");
  });

  it("prioritizes cancelled over every other signal", () => {
    expect(
      getEventFinancialStatus({
        ...base,
        eventCancelled: true,
        hasOverdueInvoice: true,
        depositRequired: true,
        depositPaidMinor: 0,
      }),
    ).toBe("cancelled");
  });

  it("prioritizes overdue over deposit states", () => {
    expect(
      getEventFinancialStatus({
        ...base,
        hasOverdueInvoice: true,
        depositRequired: true,
        depositRequiredMinor: 50000,
        depositPaidMinor: 0,
      }),
    ).toBe("overdue");
  });

  it("is deterministic — the same input always produces the same output", () => {
    expect(getEventFinancialStatus(base)).toBe(getEventFinancialStatus(base));
  });
});
