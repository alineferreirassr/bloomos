import { describe, expect, it } from "vitest";
import { handleFinanceRpcError, FINANCE_VALIDATION_ERROR_CODES } from "@/lib/data/finance/errors";

describe("FINANCE_VALIDATION_ERROR_CODES", () => {
  it("covers every custom errcode raised by the committed Finance Ledger RPCs", () => {
    for (const code of [
      "P0010",
      "P1100",
      "P1101",
      "P1102",
      "P1103",
      "P1104",
      "P1105",
      "P1106",
      "P1107",
      "P1108",
      "P1109",
      "P1110",
      "P1111",
      "P1112",
      "P1113",
      "P1114",
      "P1115",
      "P1116",
      "P1117",
    ]) {
      expect(FINANCE_VALIDATION_ERROR_CODES.has(code)).toBe(true);
    }
  });

  it("does not include generic Postgres/PostgREST SQLSTATE codes — those remain normalizeSupabaseError's responsibility", () => {
    for (const code of ["23505", "23503", "PGRST116", "42501", "23502", "23514"]) {
      expect(FINANCE_VALIDATION_ERROR_CODES.has(code)).toBe(false);
    }
  });
});

describe("handleFinanceRpcError", () => {
  it("returns a DataResult fail() with the original (already safe/authored) message for a known Finance errcode", () => {
    const result = handleFinanceRpcError({ code: "P1104", message: "This payment has already been posted." });
    expect(result).toEqual({ success: false, error: "This payment has already been posted.", fieldErrors: undefined });
  });

  it("throws (via normalizeSupabaseError) for an error code outside the Finance set", () => {
    expect(() => handleFinanceRpcError({ code: "42501", message: "permission denied for table journal_entries" })).toThrow(
      "You don't have permission to do that.",
    );
  });

  it("throws for an error with no code at all", () => {
    expect(() => handleFinanceRpcError({ message: "fetch failed" })).toThrow();
  });

  it("never leaks the raw error object as the DataResult message for an unrecognized code — the message is re-derived by normalizeSupabaseError, not passed through", () => {
    try {
      handleFinanceRpcError({ code: "23505", message: 'duplicate key value violates unique constraint "journal_entries_pkey"' });
      throw new Error("expected handleFinanceRpcError to throw");
    } catch (error) {
      expect((error as Error).message).not.toMatch(/constraint|pkey/);
    }
  });
});
