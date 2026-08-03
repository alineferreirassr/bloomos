import { extractTemplateFields, renderBlocks, type TemplateScope } from "@/core/documents/templateEngine";
import { getMergeField } from "@/core/documents/mergeFieldRegistry";
import { resolveMergeFields } from "@/core/documents/mergeEngine";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import { getClientById, getLeadById, getEventById, getInvoiceById, getContract, getVendorById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import type { Permission } from "@/core/enums/permission";
import type { DocumentBlock, DocumentIssue, MergeContext, Template } from "@/types/documentPlatform";

/** The permission/role context a compile is attempted under — a caller's own resolved session, never the Template's own author. */
export interface CompilePermissionContext {
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
}

export interface CompiledTemplateContent {
  content: DocumentBlock[];
  header: DocumentBlock[];
  footer: DocumentBlock[];
  /** The fully-resolved Merge Field scope this compile ran against — exposed so a caller (e.g. `core/documents/manager.ts`) can build `ComposedDocumentMetadata` (`clientName`/`eventTitle`) without a second, redundant resolution pass. */
  scope: TemplateScope;
}

export type CompileTemplateResult = { success: true; compiled: CompiledTemplateContent } | { success: false; issues: DocumentIssue[] };

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

/** `"item"`/`"item.field"` are the Template Engine's own loop-local bindings (see `templateEngine.ts`) — never registered Merge Fields, so they're exempt from the `unknown_field` check. */
function isLoopLocalReference(key: string): boolean {
  return key === "item" || key.startsWith("item.");
}

/** Step 16's own "Role aware. Template aware. Feature Flag aware." — every gate a `Template` itself declares, checked together. */
async function checkPermissions(template: Template, workspaceId: string, context: CompilePermissionContext): Promise<DocumentIssue[]> {
  const issues: DocumentIssue[] = [];
  if (template.requiredPermissions.some((permission) => !context.permissions.includes(permission))) {
    issues.push({ code: "permission_denied", target: template.id, message: `You don't have permission to compile "${template.name}".` });
  }
  if (template.minimumRole && (!context.role || !roleMeetsMinimum(context.role, template.minimumRole))) {
    issues.push({ code: "permission_denied", target: template.id, message: `Your role can't compile "${template.name}".` });
  }
  if (template.featureFlag) {
    const enabled = await evaluateFeatureFlag(workspaceId, template.featureFlag);
    if (!enabled) issues.push({ code: "permission_denied", target: template.id, message: `"${template.name}" isn't enabled for this Workspace yet.` });
  }
  return issues;
}

/**
 * v2 Checkpoint 45 security fix — every optional id on `MergeContext`
 * (`clientId`/`leadId`/`eventId`/`invoiceId`/`contractId`/`proposalId`/
 * `vendorId`) is caller-supplied (from `compileDocumentAction`'s own input,
 * or from a Workflow/Automation's own trigger facts) and was never checked
 * against the compiling session's own `workspaceId` before being handed to
 * the Merge Field resolvers — `crmMergeFields.ts`/`financeMergeFields.ts`/
 * `leadMergeFields.ts`/`vendorMergeFields.ts`/`proposalMergeFields.ts` all
 * fetch purely by id. That meant any active member of any workspace could
 * compile a Document with another workspace's `clientId`/`invoiceId`/etc.
 * and have that workspace's own name/email/phone/address/financials merged
 * into a Document they could read — a cross-tenant data leak. This is the
 * one choke point every compile (manual or Workflow-generated) already
 * passes through, so fixing it here protects every caller at once, the
 * same "single choke point" precedent `recordTimelineActivity()` already
 * set for Timeline writes. `automationId`/`automationExecutionId` are
 * exempt — `workflowMergeFields.ts` only regex-parses `automationId`, it's
 * never used to fetch a record, so there's nothing to leak.
 */
async function validateMergeContextOwnership(context: MergeContext): Promise<DocumentIssue[]> {
  const checks: [string, string | undefined, () => Promise<{ workspace_id: string } | null>][] = [
    ["clientId", context.clientId, () => getClientById(context.clientId!).catch(() => null)],
    ["leadId", context.leadId, () => getLeadById(context.leadId!).catch(() => null)],
    ["eventId", context.eventId, () => getEventById(context.eventId!).catch(() => null)],
    ["invoiceId", context.invoiceId, () => getInvoiceById(context.invoiceId!).catch(() => null)],
    ["contractId", context.contractId, () => getContract(context.contractId!).catch(() => null)],
    ["vendorId", context.vendorId, () => getVendorById(context.vendorId!).catch(() => null)],
    ["proposalId", context.proposalId, () => getProposalsRepository().getProposalById(context.proposalId!)],
  ];

  const results = await Promise.all(
    checks
      .filter(([, id]) => Boolean(id))
      .map(async ([field, , fetchRecord]) => {
        const record = await fetchRecord();
        const owned = record !== null && record.workspace_id === context.workspaceId;
        return { field, owned };
      }),
  );

  return results
    .filter((result) => !result.owned)
    .map((result) => ({ code: "permission_denied" as const, target: result.field, message: "One or more linked records for this Document couldn't be found in this Workspace." }));
}

/**
 * Structural sanity checks a `DocumentBlock[]` loaded from storage should
 * still satisfy even though authoring-time TypeScript already enforces the
 * shape — the same defensive posture `core/settings/validation.ts`'s own
 * `checkType()` takes for a Setting's stored value. Narrow on purpose:
 * this checks the two ways a block can be structurally broken without
 * being a type error (a `heading` with an out-of-range `level`, a `table`
 * with a genuinely empty row), not full JSON-schema validation.
 */
function checkFormatting(blocks: DocumentBlock[]): DocumentIssue[] {
  const issues: DocumentIssue[] = [];

  function visit(block: DocumentBlock) {
    if (block.type === "heading" && ![1, 2, 3].includes(block.level)) {
      issues.push({ code: "invalid_formatting", target: block.id, message: `Heading block "${block.id}" has an invalid level (must be 1, 2, or 3).` });
    }
    if (block.type === "table" && block.rows.some((row) => row.length === 0)) {
      issues.push({ code: "invalid_formatting", target: block.id, message: `Table block "${block.id}" has an empty row.` });
    }
    if (block.type === "conditional") for (const child of block.blocks) visit(child);
    if (block.type === "loop") for (const child of block.itemBlocks) visit(child);
  }

  for (const block of blocks) visit(block);
  return issues;
}

/**
 * Step 5's own Document Compiler — Template + Resolved Variables → Final
 * Document, made concrete: 1) permission gate, 2) collect every Merge
 * Field the Template's own `content`/`header`/`footer` reference,
 * validating each against the Merge Field Registry (`unknown_field`) and,
 * once resolved, against its own `required` flag (`missing_variable`,
 * unless the Template declares a `TemplateVariable.fallback` for it), 3)
 * structural formatting checks, 4) only once every check passes, render
 * the block trees via the Template Engine. Returns every applicable issue
 * at once, the same "surface everything, not just the first" precedent
 * `core/settings/validation.ts`/`core/workflow/validation.ts` already
 * established — never throws.
 */
export async function compileTemplate(template: Template, context: MergeContext, permissionContext: CompilePermissionContext): Promise<CompileTemplateResult> {
  const issues: DocumentIssue[] = [
    ...(await checkPermissions(template, context.workspaceId, permissionContext)),
    ...(await validateMergeContextOwnership(context)),
  ];

  const allBlocks = [...template.header, ...template.content, ...template.footer];
  const referencedFields = extractTemplateFields(allBlocks).filter((key) => !isLoopLocalReference(key));

  for (const key of referencedFields) {
    if (!getMergeField(key)) {
      issues.push({ code: "unknown_field", target: key, message: `"${key}" isn't a registered Merge Field.` });
    }
  }

  issues.push(...checkFormatting(allBlocks));

  if (issues.length > 0) return { success: false, issues };

  const scope = await resolveMergeFields(context);

  const fallbackByKey = new Map(template.variables.map((variable) => [variable.key, variable.fallback]));
  for (const key of referencedFields) {
    const definition = getMergeField(key);
    if (!definition?.required) continue;
    if (scope[key] !== null && scope[key] !== undefined) continue;
    const fallback = fallbackByKey.get(key);
    if (fallback !== undefined && fallback !== null) {
      scope[key] = fallback;
      continue;
    }
    issues.push({ code: "missing_variable", target: key, message: `"${definition.label}" is required but has no value for this Document.` });
  }

  if (issues.length > 0) return { success: false, issues };

  return {
    success: true,
    compiled: {
      content: renderBlocks(template.content, scope),
      header: renderBlocks(template.header, scope),
      footer: renderBlocks(template.footer, scope),
      scope,
    },
  };
}
