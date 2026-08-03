import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/featureFlags", () => ({ evaluateFeatureFlag: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/data", () => ({
  getClientById: vi.fn(),
  getLeadById: vi.fn(),
  getEventById: vi.fn(),
  getInvoiceById: vi.fn(),
  getContract: vi.fn(),
  getVendorById: vi.fn(),
}));
vi.mock("@/lib/data/proposals", () => ({ getProposalsRepository: vi.fn() }));

import { compileTemplate } from "@/core/documents/compiler";
import { registerMergeField, resetMergeFieldRegistry } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver, resetMergeResolvers } from "@/core/documents/mergeEngine";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { getClientById, getLeadById, getEventById, getInvoiceById, getContract, getVendorById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import type { MergeContext, ParagraphBlock, Template } from "@/types/documentPlatform";

const baseContext: MergeContext = { workspaceId: "ws_1", memberId: "member_1" };
const openPermissions = { permissions: [], role: null };

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "template_1",
    workspaceId: "ws_1",
    documentTypeId: "contract",
    name: "Test Template",
    description: "",
    status: "published",
    content: [],
    header: [],
    footer: [],
    variables: [],
    version: 1,
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    createdBy: "member_1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function paragraph(text: string, id = "p1"): ParagraphBlock {
  return { id, type: "paragraph", runs: [{ text }] };
}

describe("compileTemplate", () => {
  beforeEach(() => {
    resetMergeFieldRegistry();
    resetMergeResolvers();
    registerMergeField({ key: "client_name", label: "Client Name", description: "", domain: "crm", valueType: "string", required: true });
    registerMergeField({ key: "partner_name", label: "Partner Name", description: "", domain: "crm", valueType: "string", required: false });
    registerMergeResolver("client_name", async () => "Alex Rivera");
    registerMergeResolver("partner_name", async () => null);
    vi.mocked(getClientById).mockReset();
    vi.mocked(getLeadById).mockReset();
    vi.mocked(getEventById).mockReset();
    vi.mocked(getInvoiceById).mockReset();
    vi.mocked(getContract).mockReset();
    vi.mocked(getVendorById).mockReset();
    vi.mocked(getProposalsRepository).mockReset();
  });

  it("compiles a template with a fully-resolved required field", async () => {
    const template = makeTemplate({ content: [paragraph("Dear {{client_name}},")] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.compiled.content[0] as ParagraphBlock).runs[0].text).toBe("Dear Alex Rivera,");
  });

  it("renders an unresolved optional field as an empty string, no issue raised", async () => {
    const template = makeTemplate({ content: [paragraph("{{partner_name}}", "p1")] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(true);
  });

  it("raises permission_denied when the Template's own feature flag is disabled", async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValueOnce(false);
    const template = makeTemplate({ featureFlag: "documents.experimental-template" });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.code === "permission_denied")).toBe(true);
  });

  it("succeeds once the Template's own feature flag is enabled", async () => {
    vi.mocked(evaluateFeatureFlag).mockResolvedValueOnce(true);
    const template = makeTemplate({ featureFlag: "documents.experimental-template" });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(true);
  });

  it("raises permission_denied when the caller lacks a required permission", async () => {
    const template = makeTemplate({ requiredPermissions: ["documents.create"] });
    const result = await compileTemplate(template, baseContext, { permissions: [], role: null });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.code === "permission_denied")).toBe(true);
  });

  it("raises permission_denied when the caller's role doesn't meet minimumRole", async () => {
    const template = makeTemplate({ minimumRole: "owner" });
    const result = await compileTemplate(template, baseContext, { permissions: [], role: "staff" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.code === "permission_denied")).toBe(true);
  });

  it("succeeds once permission and role gates are met", async () => {
    const template = makeTemplate({ requiredPermissions: ["documents.create"], minimumRole: "manager" });
    const result = await compileTemplate(template, baseContext, { permissions: ["documents.create"], role: "owner" });
    expect(result.success).toBe(true);
  });

  it("raises unknown_field for a placeholder referencing an unregistered Merge Field", async () => {
    const template = makeTemplate({ content: [paragraph("{{not_a_real_field}}")] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues).toEqual([{ code: "unknown_field", target: "not_a_real_field", message: expect.stringContaining("not_a_real_field") }]);
  });

  it("raises missing_variable when a required field resolves to null and no fallback exists", async () => {
    registerMergeResolver("client_name", async () => null);
    const template = makeTemplate({ content: [paragraph("{{client_name}}")] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.code === "missing_variable" && issue.target === "client_name")).toBe(true);
  });

  it("uses a TemplateVariable's own fallback instead of raising missing_variable", async () => {
    registerMergeResolver("client_name", async () => null);
    const template = makeTemplate({ content: [paragraph("Dear {{client_name}},")], variables: [{ key: "client_name", fallback: "our valued client" }] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.compiled.content[0] as ParagraphBlock).runs[0].text).toBe("Dear our valued client,");
  });

  it("raises invalid_formatting for a heading with an out-of-range level", async () => {
    const template = makeTemplate({ content: [{ id: "h1", type: "heading", level: 7 as never, runs: [{ text: "Title" }] }] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.code === "invalid_formatting")).toBe(true);
  });

  it("raises invalid_formatting for a table with an empty row", async () => {
    const template = makeTemplate({ content: [{ id: "t1", type: "table", rows: [[]] }] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.code === "invalid_formatting")).toBe(true);
  });

  it("compiles header and footer blocks independently of content", async () => {
    const template = makeTemplate({
      header: [paragraph("{{client_name}}", "h")],
      content: [paragraph("Body", "b")],
      footer: [paragraph("{{client_name}}", "f")],
    });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.compiled.header[0] as ParagraphBlock).runs[0].text).toBe("Alex Rivera");
    expect((result.compiled.footer[0] as ParagraphBlock).runs[0].text).toBe("Alex Rivera");
  });

  it("never flags a loop-local {{item}}/{{item.field}} reference as unknown_field", async () => {
    registerMergeField({ key: "tags", label: "Tags", description: "", domain: "crm", valueType: "list", required: false });
    registerMergeResolver("tags", async () => ["vip", "returning"]);
    const template = makeTemplate({ content: [{ id: "l1", type: "loop", source: "tags", itemBlocks: [paragraph("{{item}}", "p1")] }] });
    const result = await compileTemplate(template, baseContext, openPermissions);
    expect(result.success).toBe(true);
  });

  it("collects multiple issues at once rather than stopping at the first", async () => {
    const template = makeTemplate({
      requiredPermissions: ["documents.create"],
      content: [paragraph("{{unknown_one}} {{unknown_two}}")],
    });
    const result = await compileTemplate(template, baseContext, { permissions: [], role: null });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  describe("v2 Checkpoint 45 security fix — MergeContext ownership validation", () => {
    // Every id below is the "own workspace" record unless a test explicitly overrides it.
    beforeEach(() => {
      vi.mocked(getClientById).mockResolvedValue({ id: "client_1", workspace_id: "ws_1" } as never);
      vi.mocked(getLeadById).mockResolvedValue({ id: "lead_1", workspace_id: "ws_1" } as never);
      vi.mocked(getEventById).mockResolvedValue({ id: "event_1", workspace_id: "ws_1" } as never);
      vi.mocked(getInvoiceById).mockResolvedValue({ id: "invoice_1", workspace_id: "ws_1" } as never);
      vi.mocked(getContract).mockResolvedValue({ id: "contract_1", workspace_id: "ws_1" } as never);
      vi.mocked(getVendorById).mockResolvedValue({ id: "vendor_1", workspace_id: "ws_1" } as never);
      vi.mocked(getProposalsRepository).mockReturnValue({
        getProposalById: vi.fn().mockResolvedValue({ id: "proposal_1", workspace_id: "ws_1" }),
      } as never);
    });

    it("succeeds when every linked id belongs to the compiling workspace (positive case)", async () => {
      const template = makeTemplate({ content: [paragraph("Dear {{client_name}},")] });
      const context: MergeContext = { ...baseContext, clientId: "client_1", eventId: "event_1", invoiceId: "invoice_1", contractId: "contract_1", leadId: "lead_1", vendorId: "vendor_1", proposalId: "proposal_1" };
      const result = await compileTemplate(template, context, openPermissions);
      expect(result.success).toBe(true);
    });

    it("succeeds when no ids are present at all (negative case — nothing to check)", async () => {
      const template = makeTemplate({ content: [paragraph("Dear {{client_name}},")] });
      const result = await compileTemplate(template, baseContext, openPermissions);
      expect(result.success).toBe(true);
      expect(getClientById).not.toHaveBeenCalled();
    });

    it("cross-tenant regression: rejects a clientId that belongs to a different workspace", async () => {
      vi.mocked(getClientById).mockResolvedValue({ id: "client_1", workspace_id: "ws_evil" } as never);
      const template = makeTemplate({ content: [paragraph("Dear {{client_name}},")] });
      const context: MergeContext = { ...baseContext, clientId: "client_1" };
      const result = await compileTemplate(template, context, openPermissions);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "permission_denied", target: "clientId" })]));
    });

    it("cross-tenant regression: rejects an eventId that belongs to a different workspace", async () => {
      vi.mocked(getEventById).mockResolvedValue({ id: "event_1", workspace_id: "ws_evil" } as never);
      const template = makeTemplate({ content: [] });
      const context: MergeContext = { ...baseContext, eventId: "event_1" };
      const result = await compileTemplate(template, context, openPermissions);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "permission_denied", target: "eventId" })]));
    });

    it("cross-tenant regression: rejects an invoiceId that belongs to a different workspace", async () => {
      vi.mocked(getInvoiceById).mockResolvedValue({ id: "invoice_1", workspace_id: "ws_evil" } as never);
      const template = makeTemplate({ content: [] });
      const context: MergeContext = { ...baseContext, invoiceId: "invoice_1" };
      const result = await compileTemplate(template, context, openPermissions);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "permission_denied", target: "invoiceId" })]));
    });

    it("cross-tenant regression: rejects a contractId that belongs to a different workspace", async () => {
      vi.mocked(getContract).mockResolvedValue({ id: "contract_1", workspace_id: "ws_evil" } as never);
      const template = makeTemplate({ content: [] });
      const context: MergeContext = { ...baseContext, contractId: "contract_1" };
      const result = await compileTemplate(template, context, openPermissions);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "permission_denied", target: "contractId" })]));
    });

    it("cross-tenant regression: rejects a leadId/vendorId/proposalId that belong to a different workspace", async () => {
      vi.mocked(getLeadById).mockResolvedValue({ id: "lead_1", workspace_id: "ws_evil" } as never);
      vi.mocked(getVendorById).mockResolvedValue({ id: "vendor_1", workspace_id: "ws_evil" } as never);
      vi.mocked(getProposalsRepository).mockReturnValue({
        getProposalById: vi.fn().mockResolvedValue({ id: "proposal_1", workspace_id: "ws_evil" }),
      } as never);
      const template = makeTemplate({ content: [] });
      const context: MergeContext = { ...baseContext, leadId: "lead_1", vendorId: "vendor_1", proposalId: "proposal_1" };
      const result = await compileTemplate(template, context, openPermissions);
      expect(result.success).toBe(false);
      if (result.success) return;
      const targets = result.issues.filter((issue) => issue.code === "permission_denied").map((issue) => issue.target);
      expect(targets).toEqual(expect.arrayContaining(["leadId", "vendorId", "proposalId"]));
    });

    it("rejects an id that doesn't exist at all, the same as one from another workspace", async () => {
      vi.mocked(getClientById).mockRejectedValue(new Error("not found"));
      const template = makeTemplate({ content: [] });
      const context: MergeContext = { ...baseContext, clientId: "client_missing" };
      const result = await compileTemplate(template, context, openPermissions);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "permission_denied", target: "clientId" })]));
    });

    it("never leaks whether the record exists in another workspace vs. not existing at all — same generic message either way", async () => {
      vi.mocked(getClientById).mockResolvedValueOnce({ id: "client_1", workspace_id: "ws_evil" } as never);
      const templateA = makeTemplate({ content: [] });
      const resultA = await compileTemplate(templateA, { ...baseContext, clientId: "client_1" }, openPermissions);

      vi.mocked(getClientById).mockRejectedValueOnce(new Error("not found"));
      const templateB = makeTemplate({ content: [] });
      const resultB = await compileTemplate(templateB, { ...baseContext, clientId: "client_missing" }, openPermissions);

      expect(resultA.success).toBe(false);
      expect(resultB.success).toBe(false);
      if (resultA.success || resultB.success) return;
      expect(resultA.issues[0].message).toBe(resultB.issues[0].message);
    });
  });
});
