import { describe, expect, it } from "vitest";
import { contractSchema } from "@/modules/contracts/schema";

const validInput = {
  client_id: "client_1",
  event_id: null,
  template_id: null,
  title: "Test Contract",
  description: null,
  effective_date: null,
  expiration_date: null,
  total_value: 1000,
  deposit_required: false,
  deposit_amount: null,
  currency: "usd",
  notes: null,
};

describe("contractSchema", () => {
  it("accepts a minimal valid contract and normalizes currency to uppercase", () => {
    const result = contractSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("rejects a missing client_id", () => {
    const result = contractSchema.safeParse({ ...validInput, client_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing title", () => {
    const result = contractSchema.safeParse({ ...validInput, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a currency code that isn't 3 letters", () => {
    const result = contractSchema.safeParse({ ...validInput, currency: "US" });
    expect(result.success).toBe(false);
  });

  it("requires a deposit_amount when deposit_required is true", () => {
    const result = contractSchema.safeParse({ ...validInput, deposit_required: true, deposit_amount: null });
    expect(result.success).toBe(false);
  });

  it("rejects a deposit_amount when deposit_required is false", () => {
    const result = contractSchema.safeParse({ ...validInput, deposit_required: false, deposit_amount: 100 });
    expect(result.success).toBe(false);
  });

  it("accepts a deposit_amount when deposit_required is true", () => {
    const result = contractSchema.safeParse({
      ...validInput,
      deposit_required: true,
      deposit_amount: 250,
      total_value: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a deposit_amount greater than total_value", () => {
    const result = contractSchema.safeParse({
      ...validInput,
      deposit_required: true,
      deposit_amount: 1500,
      total_value: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an expiration_date before effective_date", () => {
    const result = contractSchema.safeParse({
      ...validInput,
      effective_date: "2026-06-10",
      expiration_date: "2026-06-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an expiration_date equal to effective_date", () => {
    const result = contractSchema.safeParse({
      ...validInput,
      effective_date: "2026-06-10",
      expiration_date: "2026-06-10",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a negative-free total_value of zero", () => {
    const result = contractSchema.safeParse({ ...validInput, total_value: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative total_value", () => {
    const result = contractSchema.safeParse({ ...validInput, total_value: -1 });
    expect(result.success).toBe(false);
  });
});
