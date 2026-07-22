import { describe, expect, it } from "vitest";
import { makeLead } from "@/modules/leads/testUtils";
import {
  EMPTY_COMMERCIAL_FILTERS,
  collectAssignees,
  columnPipelineValue,
  filterCommercialLeads,
  groupLeadsByColumn,
  leadToFormInput,
} from "@/modules/pipeline/logic";

describe("groupLeadsByColumn", () => {
  it("buckets new/contacted/welcome_guide_sent together under 'lead'", () => {
    const leads = [
      makeLead({ id: "l1", status: "new" }),
      makeLead({ id: "l2", status: "contacted" }),
      makeLead({ id: "l3", status: "welcome_guide_sent" }),
    ];
    const columns = groupLeadsByColumn(leads);
    expect(columns.lead.map((l) => l.id).sort()).toEqual(["l1", "l2", "l3"]);
  });

  it("excludes converted/lost/archived Leads entirely", () => {
    const leads = [
      makeLead({ id: "l1", status: "converted" }),
      makeLead({ id: "l2", status: "lost" }),
      makeLead({ id: "l3", status: "archived" }),
      makeLead({ id: "l4", status: "qualified" }),
    ];
    const columns = groupLeadsByColumn(leads);
    const allBoarded = Object.values(columns).flat();
    expect(allBoarded.map((l) => l.id)).toEqual(["l4"]);
  });

  it("gives every column its own bucket even when empty", () => {
    const columns = groupLeadsByColumn([]);
    expect(columns.booked).toEqual([]);
    expect(columns.qualified).toEqual([]);
  });
});

describe("filterCommercialLeads", () => {
  const leads = [
    makeLead({ id: "l1", first_name: "Priya", last_name: "Nair", assigned_to: "Jamie", budget_max: 5000, created_at: "2026-01-05T00:00:00.000Z" }),
    makeLead({ id: "l2", first_name: "Sam", last_name: "Ortiz", assigned_to: "Alex", budget_max: 12000, created_at: "2026-02-10T00:00:00.000Z" }),
    makeLead({ id: "l3", first_name: "Priya", last_name: "Chen", assigned_to: null, budget_min: 2000, budget_max: null, created_at: "2026-03-01T00:00:00.000Z" }),
  ];

  it("matches by name/email/event_type substring, case-insensitive", () => {
    const result = filterCommercialLeads(leads, { ...EMPTY_COMMERCIAL_FILTERS, search: "priya" });
    expect(result.map((l) => l.id).sort()).toEqual(["l1", "l3"]);
  });

  it("filters by assignedTo", () => {
    const result = filterCommercialLeads(leads, { ...EMPTY_COMMERCIAL_FILTERS, assignedTo: "Alex" });
    expect(result.map((l) => l.id)).toEqual(["l2"]);
  });

  it("filters by budget range using budget_max falling back to budget_min", () => {
    const result = filterCommercialLeads(leads, { ...EMPTY_COMMERCIAL_FILTERS, budgetMin: "3000" });
    expect(result.map((l) => l.id).sort()).toEqual(["l1", "l2"]);
  });

  it("excludes Leads with no budget data at all when a budget filter is active", () => {
    const noBudgetLead = makeLead({ id: "l4", budget_min: null, budget_max: null });
    const result = filterCommercialLeads([...leads, noBudgetLead], { ...EMPTY_COMMERCIAL_FILTERS, budgetMin: "0" });
    expect(result.some((l) => l.id === "l4")).toBe(false);
  });

  it("filters by created_at date range", () => {
    const result = filterCommercialLeads(leads, {
      ...EMPTY_COMMERCIAL_FILTERS,
      createdFrom: "2026-02-01",
      createdTo: "2026-02-28",
    });
    expect(result.map((l) => l.id)).toEqual(["l2"]);
  });

  it("returns everything when no filters are active", () => {
    expect(filterCommercialLeads(leads, EMPTY_COMMERCIAL_FILTERS)).toHaveLength(3);
  });
});

describe("columnPipelineValue", () => {
  it("sums budget_max, falling back to budget_min, treating missing data as 0", () => {
    const leads = [
      makeLead({ budget_max: 5000 }),
      makeLead({ budget_max: null, budget_min: 2000 }),
      makeLead({ budget_max: null, budget_min: null }),
    ];
    expect(columnPipelineValue(leads)).toBe(7000);
  });

  it("returns 0 for an empty column", () => {
    expect(columnPipelineValue([])).toBe(0);
  });
});

describe("collectAssignees", () => {
  it("returns distinct, sorted, non-empty assignees", () => {
    const leads = [
      makeLead({ assigned_to: "Jamie" }),
      makeLead({ assigned_to: "Alex" }),
      makeLead({ assigned_to: "Jamie" }),
      makeLead({ assigned_to: null }),
    ];
    expect(collectAssignees(leads)).toEqual(["Alex", "Jamie"]);
  });
});

describe("leadToFormInput", () => {
  it("converts every null field to an empty string and numbers to strings", () => {
    const lead = makeLead({
      phone: null,
      instagram: null,
      event_type: null,
      event_date: null,
      location: null,
      budget_min: null,
      budget_max: 5000,
      message: null,
      assigned_to: null,
    });
    const input = leadToFormInput(lead);
    expect(input).toMatchObject({
      phone: "",
      instagram: "",
      event_type: "",
      event_date: "",
      location: "",
      budget_min: "",
      budget_max: "5000",
      message: "",
      assigned_to: "",
    });
  });

  it("round-trips non-null fields as-is", () => {
    const lead = makeLead({ first_name: "Jamie", last_name: "Rivera", email: "jamie@example.com", source: "Referral" });
    const input = leadToFormInput(lead);
    expect(input.first_name).toBe("Jamie");
    expect(input.last_name).toBe("Rivera");
    expect(input.email).toBe("jamie@example.com");
    expect(input.source).toBe("Referral");
  });
});
