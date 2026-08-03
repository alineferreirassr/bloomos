import { describe, expect, it } from "vitest";
import {
  formatMoney,
  minorToMajor,
  majorToMinor,
  addMinor,
  subtractMinor,
  sumMinor,
  calculateBalance,
  calculatePercentage,
} from "@/lib/money";

describe("formatMoney", () => {
  it("formats an integer minor-unit amount as USD currency", () => {
    expect(formatMoney(125000, "USD")).toBe("$1,250.00");
  });

  it("formats zero correctly", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });

  it("uppercases a lowercase currency code", () => {
    expect(formatMoney(100, "usd")).toBe("$1.00");
  });

  it("throws for a non-integer amount", () => {
    expect(() => formatMoney(125.5, "USD")).toThrow(TypeError);
  });
});

describe("minorToMajor / majorToMinor", () => {
  it("converts minor to major", () => {
    expect(minorToMajor(125000)).toBe(1250);
  });

  it("converts major to minor", () => {
    expect(majorToMinor(1250)).toBe(125000);
  });

  it("rounds majorToMinor to absorb floating-point noise", () => {
    expect(majorToMinor(19.99)).toBe(1999);
  });

  it("throws minorToMajor for a non-integer amount", () => {
    expect(() => minorToMajor(100.5)).toThrow(TypeError);
  });
});

describe("addMinor / subtractMinor / sumMinor", () => {
  it("adds two integer amounts", () => {
    expect(addMinor(100, 200)).toBe(300);
  });

  it("subtracts two integer amounts", () => {
    expect(subtractMinor(300, 100)).toBe(200);
  });

  it("allows subtraction to go negative — callers clamp explicitly where needed", () => {
    expect(subtractMinor(100, 300)).toBe(-200);
  });

  it("throws for a non-integer operand", () => {
    expect(() => addMinor(100.5, 200)).toThrow(TypeError);
    expect(() => subtractMinor(100, 200.5)).toThrow(TypeError);
  });

  it("sums a list of amounts", () => {
    expect(sumMinor([100, 200, 300])).toBe(600);
  });

  it("sums an empty list to zero", () => {
    expect(sumMinor([])).toBe(0);
  });
});

describe("calculateBalance", () => {
  it("computes total minus paid", () => {
    expect(calculateBalance(1000, 400)).toBe(600);
  });

  it("floors at zero for an overpayment", () => {
    expect(calculateBalance(1000, 1500)).toBe(0);
  });

  it("returns the full total when nothing has been paid", () => {
    expect(calculateBalance(1000, 0)).toBe(1000);
  });
});

describe("calculatePercentage", () => {
  it("computes a rounded percentage", () => {
    expect(calculatePercentage(50, 200)).toBe(25);
  });

  it("returns 0 when whole is 0", () => {
    expect(calculatePercentage(50, 0)).toBe(0);
  });

  it("returns 0 when whole is negative", () => {
    expect(calculatePercentage(50, -10)).toBe(0);
  });

  it("returns 100 when part equals whole", () => {
    expect(calculatePercentage(200, 200)).toBe(100);
  });

  it("rounds to the nearest integer", () => {
    expect(calculatePercentage(1, 3)).toBe(33);
  });
});
