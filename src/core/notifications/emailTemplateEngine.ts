import { extractPlaceholdersFromText, interpolateText, type TemplateScope } from "@/core/documents/templateEngine";
import { resolveMergeFields } from "@/core/documents/mergeEngine";
import { listMergeFields } from "@/core/documents/mergeFieldRegistry";
import type { MergeContext } from "@/types/documentPlatform";
import type { NotificationTemplate } from "@/types/notificationPlatform";

/**
 * v2 Checkpoint 44, Step 8 — the Email Template Library. Reuses the real
 * Notification Template store (`NotificationTemplate.titleTemplate`/
 * `bodyTemplate`, Checkpoint 41) as its own source of authored content, and
 * the Document Platform's own Merge Field Engine/Template Engine
 * (`resolveMergeFields`/`interpolateText`, Checkpoint 12/44) as its own
 * resolution mechanism — the identical `{{key}}` placeholder syntax an
 * author already knows from the Document Editor's own Variables Panel.
 * Never a second templating language, never a second placeholder registry:
 * a `NotificationTemplate`'s own `{{client_name}}` and a Document
 * Template's own `{{client_name}}` are the exact same Merge Field.
 */

export interface ResolvedNotificationContent {
  title: string;
  body: string;
}

/** Resolves a `NotificationTemplate`'s own `titleTemplate`/`bodyTemplate` against `context` — ready to hand to `buildNotificationInput()` (in-app) or a `NotificationDeliveryRequest` (email). */
export async function resolveNotificationTemplate(template: NotificationTemplate, context: MergeContext): Promise<ResolvedNotificationContent> {
  const scope = await resolveMergeFields(context);
  return {
    title: interpolateText(template.titleTemplate, scope),
    body: interpolateText(template.bodyTemplate, scope),
  };
}

/** Every `{{key}}` reference in either `titleTemplate` or `bodyTemplate` that isn't a registered Merge Field — the same "unknown_field" check the Document Compiler runs on a block tree, applied to this template's own two plain strings. An author sees this before the template ever gets sent, never a silent blank in the recipient's inbox. */
export function findUnknownEmailTemplatePlaceholders(template: NotificationTemplate): string[] {
  const knownKeys = new Set(listMergeFields().map((definition) => definition.key));
  const referenced = new Set([...extractPlaceholdersFromText(template.titleTemplate), ...extractPlaceholdersFromText(template.bodyTemplate)]);
  return [...referenced].filter((key) => !knownKeys.has(key));
}

/** Test/debug-only: resolves a raw `{title, body}` pair without needing a stored `NotificationTemplate` record — useful for previewing a template still being authored. */
export async function previewNotificationContent(titleTemplate: string, bodyTemplate: string, context: MergeContext): Promise<ResolvedNotificationContent> {
  const scope: TemplateScope = await resolveMergeFields(context);
  return { title: interpolateText(titleTemplate, scope), body: interpolateText(bodyTemplate, scope) };
}
