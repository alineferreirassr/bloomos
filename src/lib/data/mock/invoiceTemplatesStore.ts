import type { InvoiceTemplate, InvoiceTemplateKey, InvoiceTemplateStructure, InvoicePaymentScheduleKind } from "@/types/invoicePlatform";
import { generateId, nowIso } from "@/lib/data/utils";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * v2.0 Checkpoint 35 — Invoice Template Library (Step 2). 10 system
 * templates ship pre-seeded, the same system-vs-custom split
 * `contractBuilderTemplatesStore.ts` (Checkpoint 34) established.
 */

function structure(defaultSectionTitles: string[], defaultPaymentScheduleKind: InvoicePaymentScheduleKind): InvoiceTemplateStructure {
  return {
    header: { title: "", subtitle: null, logoAssetId: null },
    defaultSectionTitles,
    defaultPaymentScheduleKind,
    footer: { text: "", contactEmail: null, contactPhone: null },
  };
}

function seedTemplates(): InvoiceTemplate[] {
  const now = nowIso();
  const base = (key: InvoiceTemplateKey, name: string, description: string, defaultSectionTitles: string[], defaultPaymentScheduleKind: InvoicePaymentScheduleKind): InvoiceTemplate => ({
    id: generateId("invoice_template"),
    workspace_id: CURRENT_WORKSPACE_ID,
    key,
    name,
    description,
    isSystemTemplate: true,
    structure: structure(defaultSectionTitles, defaultPaymentScheduleKind),
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
  });

  return [
    base("luxury_event", "Luxury Event", "A full-service luxury event invoice covering every booked line item.", ["Services", "Packages", "Fees"], "deposit_final"),
    base("proposal_deposit", "Proposal Deposit", "For collecting a deposit against an accepted Proposal.", ["Deposit"], "single_payment"),
    base("final_balance", "Final Balance", "For the remaining balance after a deposit has been collected.", ["Remaining Balance"], "single_payment"),
    base("photography", "Photography", "For standalone photography bookings.", ["Photography Services", "Travel & Fees"], "deposit_final"),
    base("ugc_services", "UGC Services", "For user-generated-content campaign services.", ["Content Services"], "two_payments"),
    base("digital_products", "Digital Products", "For one-off digital product sales.", ["Products"], "single_payment"),
    base("vendor_invoice", "Vendor Invoice", "For billing an outside vendor relationship.", ["Services", "Fees"], "single_payment"),
    base("refund", "Refund", "For issuing a refund-adjustment invoice.", ["Refund"], "single_payment"),
    base("credit_memo", "Credit Memo", "For issuing a standalone credit memo.", ["Credit"], "single_payment"),
    base("custom_template", "Custom Template", "A minimal, general-purpose starting point.", ["Line Items"], "single_payment"),
  ];
}

let templates: InvoiceTemplate[] = seedTemplates();

export function resetInvoiceTemplatesStore(): void {
  templates = seedTemplates();
}

async function listTemplates(workspaceId: string, includeArchived = false): Promise<InvoiceTemplate[]> {
  return templates.filter((t) => t.workspace_id === workspaceId && (includeArchived || t.archived_at === null)).sort((a, b) => a.name.localeCompare(b.name));
}

async function getTemplateById(id: string): Promise<InvoiceTemplate | null> {
  return templates.find((t) => t.id === id) ?? null;
}

export interface CreateCustomInvoiceTemplateInput {
  name: string;
  description: string;
  structure: InvoiceTemplateStructure;
}

async function createCustomTemplate(workspaceId: string, actor: string, input: CreateCustomInvoiceTemplateInput): Promise<InvoiceTemplate> {
  const now = nowIso();
  const template: InvoiceTemplate = {
    id: generateId("invoice_template"),
    workspace_id: workspaceId,
    key: "custom_template",
    name: input.name,
    description: input.description,
    isSystemTemplate: false,
    structure: input.structure,
    created_by: actor,
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
  templates = [...templates, template];
  return template;
}

async function archiveTemplate(id: string): Promise<InvoiceTemplate | null> {
  const existing = templates.find((t) => t.id === id);
  if (!existing || existing.isSystemTemplate) return null;
  const updated: InvoiceTemplate = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  templates = templates.map((t) => (t.id === id ? updated : t));
  return updated;
}

export interface InvoiceTemplatesRepository {
  listTemplates: typeof listTemplates;
  getTemplateById: typeof getTemplateById;
  createCustomTemplate: typeof createCustomTemplate;
  archiveTemplate: typeof archiveTemplate;
}

export const mockInvoiceTemplatesRepository: InvoiceTemplatesRepository = {
  listTemplates,
  getTemplateById,
  createCustomTemplate,
  archiveTemplate,
};
