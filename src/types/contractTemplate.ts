import type { ContractTemplateCategory } from "@/core/enums/contractTemplateCategory";

/**
 * A reusable contract body a Contract can be created from (`template_id`).
 * No editor, no HTML rendering, and no PDF generation exist yet — `body` is
 * stored as plain text containing `{{merge_field}}` placeholders (see
 * modules/contracts/mergeFields.ts for the registry of what's available;
 * nothing parses or renders them yet). Workspace-scoped like every other
 * entity, never hardcoded to a single business.
 */
export interface ContractTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  category: ContractTemplateCategory;
  body: string;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}
