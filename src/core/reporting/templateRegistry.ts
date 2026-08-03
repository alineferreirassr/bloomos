import type { ReportTemplate } from "@/types/reporting";

/** v2.0 Checkpoint 42, Step 7 — Report Templates registry. Same self-registering `Map` shape as every other registry in this codebase. Templates are definitions over the one Report Computation Engine — never a second engine per template. */
const templates = new Map<string, ReportTemplate>();

export function registerReportTemplate(template: ReportTemplate): void {
  templates.set(template.id, template);
}

export function getReportTemplate(id: string): ReportTemplate | undefined {
  return templates.get(id);
}

export function listReportTemplates(): ReportTemplate[] {
  return [...templates.values()];
}

/** Test-only. */
export function resetReportTemplateRegistry(): void {
  templates.clear();
}
