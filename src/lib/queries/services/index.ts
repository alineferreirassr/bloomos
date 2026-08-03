/**
 * ServicesQueries — the read-composition layer between `ServicesRepository`
 * (persistence) and the UI. Every function here is a plain async function:
 * no React, no React Query, no component state, no mutation. Each composes
 * one or more repository calls (plus, where genuinely needed, pure
 * `core/workflows` business-rule functions) into exactly the shape a
 * screen needs. `modules/services/hooks/*` is the only layer allowed to
 * wrap these in `useQuery`/`useMutation`.
 */
export { getServicesCatalog, searchServices } from "@/lib/queries/services/catalog";
export { getServiceEditor, getVersionHistory, getPublishPreview } from "@/lib/queries/services/editor";
export { getTemplateBuilder } from "@/lib/queries/services/templateBuilder";
export { getServiceHealth, getHealthDashboard } from "@/lib/queries/services/health";
export { getAssignmentWorkspace, getAssignmentPreview } from "@/lib/queries/services/assignment";
export { getEventServiceWorkspace, computeFulfillmentSummary } from "@/lib/queries/services/eventServiceWorkspace";
export { getServiceAssignments } from "@/lib/queries/services/assignments";
export { getEventServiceChecklistItems } from "@/lib/queries/services/eventServiceChecklist";
export * from "@/lib/queries/services/types";
