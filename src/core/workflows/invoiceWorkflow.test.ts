import { describe, expect, it } from "vitest";
import {
  canTransitionInvoiceStatus,
  getNextInvoiceStatuses,
  isInvoiceTerminal,
  getInvoiceNextRecommendedAction,
} from "@/core/workflows/invoiceWorkflow";

describe("canTransitionInvoiceStatus", () => {
  it("allows draft -> issued", () => {
    expect(canTransitionInvoiceStatus("draft", "issued")).toBe(true);
  });

  it("disallows draft -> sent directly (must issue first)", () => {
    expect(canTransitionInvoiceStatus("draft", "sent")).toBe(false);
  });

  it("allows issued -> sent", () => {
    expect(canTransitionInvoiceStatus("issued", "sent")).toBe(true);
  });

  it("allows sent -> viewed, partially_paid, paid, overdue, voided, archived", () => {
    for (const to of ["viewed", "partially_paid", "paid", "overdue", "voided", "archived"] as const) {
      expect(canTransitionInvoiceStatus("sent", to)).toBe(true);
    }
  });

  it("disallows any transition from a status to itself", () => {
    expect(canTransitionInvoiceStatus("sent", "sent")).toBe(false);
  });

  it("disallows transitions out of voided except to archived", () => {
    expect(canTransitionInvoiceStatus("voided", "draft")).toBe(false);
    expect(canTransitionInvoiceStatus("voided", "archived")).toBe(true);
  });

  it("allows archived -> draft (restore)", () => {
    expect(canTransitionInvoiceStatus("archived", "draft")).toBe(true);
  });

  it("disallows paid -> voided (a fully paid invoice can't be voided)", () => {
    expect(canTransitionInvoiceStatus("paid", "voided")).toBe(false);
  });
});

describe("getNextInvoiceStatuses", () => {
  it("returns an empty array for voided (only archived is legal, still non-empty)", () => {
    expect(getNextInvoiceStatuses("voided")).toEqual(["archived"]);
  });

  it("returns the full transition set for draft", () => {
    expect(getNextInvoiceStatuses("draft")).toEqual(["issued", "voided", "archived"]);
  });
});

describe("isInvoiceTerminal", () => {
  it("is true for voided and archived", () => {
    expect(isInvoiceTerminal("voided")).toBe(true);
    expect(isInvoiceTerminal("archived")).toBe(true);
  });

  it("is false for paid — a paid invoice can still be archived", () => {
    expect(isInvoiceTerminal("paid")).toBe(false);
  });

  it("is false for draft/sent/viewed/partially_paid/overdue/issued", () => {
    for (const status of ["draft", "issued", "sent", "viewed", "partially_paid", "overdue"] as const) {
      expect(isInvoiceTerminal(status)).toBe(false);
    }
  });
});

describe("getInvoiceNextRecommendedAction", () => {
  it("returns null for a terminal status", () => {
    expect(getInvoiceNextRecommendedAction({ status: "voided", due_date: null })).toBeNull();
    expect(getInvoiceNextRecommendedAction({ status: "archived", due_date: null })).toBeNull();
  });

  it("returns null for a fully paid invoice", () => {
    expect(getInvoiceNextRecommendedAction({ status: "paid", due_date: null })).toBeNull();
  });

  it("recommends issuing a draft invoice", () => {
    expect(getInvoiceNextRecommendedAction({ status: "draft", due_date: null })).toMatch(/issue/i);
  });

  it("recommends sending an issued invoice", () => {
    expect(getInvoiceNextRecommendedAction({ status: "issued", due_date: null })).toMatch(/send/i);
  });

  it("recommends following up on a sent, unviewed invoice", () => {
    expect(getInvoiceNextRecommendedAction({ status: "sent", due_date: null })).toMatch(/hasn't been viewed/i);
  });

  it("flags a due-soon invoice", () => {
    const dueSoon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(getInvoiceNextRecommendedAction({ status: "sent", due_date: dueSoon })).toMatch(/due soon/i);
  });

  it("recommends following up for the remaining balance on a partially paid invoice", () => {
    expect(getInvoiceNextRecommendedAction({ status: "partially_paid", due_date: null })).toMatch(/remaining balance/i);
  });

  it("flags an overdue invoice for immediate follow-up", () => {
    expect(getInvoiceNextRecommendedAction({ status: "overdue", due_date: null })).toMatch(/overdue/i);
  });

  it("is deterministic — the same input always produces the same output", () => {
    const input = { status: "sent" as const, due_date: null };
    expect(getInvoiceNextRecommendedAction(input)).toBe(getInvoiceNextRecommendedAction(input));
  });
});
