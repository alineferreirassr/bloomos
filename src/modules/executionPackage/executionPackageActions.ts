"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCoreExecutionPackagesService, type CreateVersionInput } from "@/core/executionPackage";
import { getCoreOperationalPlansService, type OperationalPlan } from "@/core/operationalPlanning";
import { getCoreAllocationsService, getCoreAllocationRequestsService, getCoreResourceBundlesService, type Allocation, type AllocationRequest, type ResourceBundle } from "@/core/allocation";
import { getCoreAppointmentsService, type Appointment } from "@/core/scheduling";
import { buildExecutionContext, buildExecutionMetadata } from "@/core/executionPackage/packageBuilderEngine";
import { buildExecutionSnapshot, hasSnapshotDrifted } from "@/core/executionPackage/snapshotEngine";
import { validatePackage } from "@/core/executionPackage/packageValidationEngine";
import { computePackageHealthScores } from "@/core/executionPackage/packageHealthEngine";
import { explainPackage } from "@/core/executionPackage/packageExplanationEngine";
import { buildExecutionInstructions } from "@/core/executionPackage/executionInstructionsEngine";
import { computePackageReadiness } from "@/core/executionPackage/readinessEngine";
import { compareExecutionVersions } from "@/core/executionPackage/packageComparisonEngine";
import { packageCreatedEvent, packageValidatedEvent, packageApprovedEvent, packageArchivedEvent, snapshotCreatedEvent, versionCreatedEvent } from "@/core/executionPackage/executionPackageTimelineEngine";
import { detectExecutionPackageRisks } from "@/core/executionPackage/executionPackageRiskEngine";
import { executionPackageFindingsToRecommendations } from "@/core/executionPackage/executionPackageFindingsEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { generateId, nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { DependencyCheckResult } from "@/types/allocation";
import type { ExecutionPackage, ExecutionAttachment, ExecutionPriority, ExecutionPackageResult, ExecutionVersionComparisonResult, PackageFinding, PackageHealthScores, PackageReadinessResult } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 27.3 — Execution Package Platform module layer.
 * Determines EVERYTHING required to perform work already planned by
 * Capability/Scheduling/Allocation/Operational Planning — an immutable,
 * frozen bundle a future Dispatch checkpoint will consume without
 * recalculating any of that planning. Never dispatches, never executes
 * a step, never captures evidence/GPS, never automates execution.
 *
 * `dependencyChecks` on `BuildExecutionPackageInput` is caller-supplied
 * and defaults to `[]` — re-deriving a fresh `DependencyCheckResult[]`
 * from scratch would mean re-running Allocation's own worker-resolution
 * and `checkDependencies` logic (internal to `allocationActions.ts`,
 * never exported), which would duplicate Allocation. Disclosed in
 * `docs/package-builder.md`, not silently omitted.
 */

const GENERIC_ACCESS_ERROR = "The Execution Package Platform isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function recordPackageTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: { type: TimelineActivityType; description: string }): void {
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

export interface BuildExecutionPackageInput {
  operationalPlanId: string;
  allocationId: string | null;
  appointmentId: string | null;
  customer: KnowledgeNodeRef | null;
  priorityOverride: ExecutionPriority | null;
  notes: string | null;
  tags: string[];
  dependencyChecks: DependencyCheckResult[];
  reason: string | null;
}

interface ResolvedSources {
  plan: OperationalPlan;
  allocation: Allocation | null;
  appointment: Appointment | null;
  allocationRequest: AllocationRequest | null;
  bundle: ResourceBundle | null;
}

async function resolveSnapshotSources(workspaceId: string, input: Pick<BuildExecutionPackageInput, "operationalPlanId" | "allocationId" | "appointmentId">): Promise<{ sources: ResolvedSources } | { error: string }> {
  const plan = await getCoreOperationalPlansService().getPlanById(input.operationalPlanId);
  if (!plan || plan.workspace_id !== workspaceId) return { error: "This operational plan could not be found." };

  const allocation = input.allocationId !== null ? await getCoreAllocationsService().getAllocationById(input.allocationId) : null;
  if (input.allocationId !== null && (!allocation || allocation.workspace_id !== workspaceId)) return { error: "This allocation could not be found." };

  const appointment = input.appointmentId !== null ? await getCoreAppointmentsService().getAppointmentById(input.appointmentId) : null;
  if (input.appointmentId !== null && (!appointment || appointment.workspace_id !== workspaceId)) return { error: "This appointment could not be found." };

  const allocationRequest = allocation !== null ? await getCoreAllocationRequestsService().getRequestById(allocation.request_id) : null;
  const bundle = allocationRequest?.bundle_id ? await getCoreResourceBundlesService().getBundleById(allocationRequest.bundle_id) : null;

  return { sources: { plan, allocation, appointment, allocationRequest, bundle } };
}

function buildAttachments(sources: ResolvedSources, customerNote: string | null): ExecutionAttachment[] {
  const attachments: ExecutionAttachment[] = [
    { id: generateId("execution_attachment"), type: "operational_plan", label: "Operational Plan", reference_id: sources.plan.id, note: null },
    { id: generateId("execution_attachment"), type: "maps_placeholder", label: "Maps", reference_id: null, note: "No maps integration yet — reserved for a future Field Operations checkpoint." },
    { id: generateId("execution_attachment"), type: "file_placeholder", label: "Files", reference_id: null, note: "No file uploads yet — reserved for a future checkpoint." },
    { id: generateId("execution_attachment"), type: "document_placeholder", label: "Documents", reference_id: null, note: "No document uploads yet — reserved for a future checkpoint." },
    { id: generateId("execution_attachment"), type: "media_placeholder", label: "Media", reference_id: null, note: "No media uploads yet — reserved for a future checkpoint." },
  ];

  for (const checklist of sources.plan.checklists) {
    if (checklist.template_id !== null) attachments.push({ id: generateId("execution_attachment"), type: "checklist_template", label: checklist.name, reference_id: checklist.template_id, note: null });
  }
  for (const evidence of sources.plan.evidence_requirements) {
    attachments.push({ id: generateId("execution_attachment"), type: "evidence_requirement", label: evidence.description, reference_id: evidence.id, note: null });
  }
  for (const deliverable of sources.plan.deliverables) {
    attachments.push({ id: generateId("execution_attachment"), type: "deliverable", label: deliverable.title, reference_id: deliverable.id, note: null });
  }
  if (customerNote !== null) {
    attachments.push({ id: generateId("execution_attachment"), type: "customer_note", label: "Customer Note", reference_id: null, note: customerNote });
  }

  return attachments;
}

function buildVersionInput(sources: ResolvedSources, dependencyChecks: DependencyCheckResult[], customerNote: string | null, notes: string | null, reason: string | null): CreateVersionInput {
  const snapshot = buildExecutionSnapshot(generateId("execution_snapshot"), nowIso(), {
    allocation: sources.allocation,
    appointment: sources.appointment ? { id: sources.appointment.id, starts_at: sources.appointment.starts_at, ends_at: sources.appointment.ends_at, calendar_id: sources.appointment.calendar_id } : null,
    plan: sources.plan,
    bundle: sources.bundle,
    dependencyChecks,
    resourcePool: null,
  });

  const instructions = buildExecutionInstructions({
    phases: sources.plan.phases,
    checklists: sources.plan.checklists,
    specialInstructions: sources.allocationRequest?.special_instructions ? [sources.allocationRequest.special_instructions] : [],
    customerNotes: customerNote !== null ? [customerNote] : [],
  });

  const attachments = buildAttachments(sources, customerNote);

  return { snapshot, instructions, attachments, notes, reason };
}

export async function buildExecutionPackageAction(input: BuildExecutionPackageInput): Promise<ActionResult<ExecutionPackage>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("execution_packages.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const resolved = await resolveSnapshotSources(workspaceId, input);
  if ("error" in resolved) return { success: false, error: resolved.error };
  const { sources } = resolved;

  const context = buildExecutionContext({
    planContextType: sources.plan.context_type,
    planContext: sources.plan.context,
    customer: input.customer,
    locationPlaceholder: sources.allocationRequest?.location_placeholder ?? null,
    requestedPriority: sources.allocationRequest?.priority ?? null,
    priorityOverride: input.priorityOverride,
  });
  const metadata = buildExecutionMetadata(sources.plan.name, input.notes, input.tags);
  const initialVersion = buildVersionInput(sources, input.dependencyChecks, input.notes, input.notes, input.reason);

  const result = await getCoreExecutionPackagesService().createPackage(workspaceId, session.membership.id, { metadata, context, source: "operational_plan_derived", initialVersion });
  if (!result.success) return { success: false, error: result.error };

  recordPackageTimelineEvent(workspaceId, context.context, packageCreatedEvent(metadata.title));
  recordPackageTimelineEvent(workspaceId, context.context, snapshotCreatedEvent(metadata.title));
  return { success: true, data: result.data };
}

export async function listExecutionPackagesAction(includeArchived = false): Promise<ActionResult<ExecutionPackage[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const packages = await getCoreExecutionPackagesService().listPackagesForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: packages };
}

export async function getExecutionPackageAction(id: string): Promise<ActionResult<ExecutionPackage>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const pkg = await getCoreExecutionPackagesService().getPackageById(id);
  if (!pkg || pkg.workspace_id !== session.workspace.id) return { success: false, error: "This execution package could not be found." };
  return { success: true, data: pkg };
}

async function fetchPackageOrFail(id: string, workspaceId: string): Promise<{ pkg: ExecutionPackage } | { error: string }> {
  const pkg = await getCoreExecutionPackagesService().getPackageById(id);
  if (!pkg || pkg.workspace_id !== workspaceId) return { error: "This execution package could not be found." };
  return { pkg };
}

function currentVersionOf(pkg: ExecutionPackage) {
  const version = pkg.versions.find((v) => v.id === pkg.current_version_id);
  return version ?? pkg.versions[pkg.versions.length - 1];
}

interface PackageAnalysis {
  validation: ReturnType<typeof validatePackage>;
  health: PackageHealthScores;
  explanation: ReturnType<typeof explainPackage>;
  readiness: PackageReadinessResult;
}

function analyzePackage(pkg: ExecutionPackage): PackageAnalysis {
  const version = currentVersionOf(pkg);
  const validation = validatePackage({ snapshot: version.snapshot });
  const health = computePackageHealthScores(version.snapshot);
  const explanation = explainPackage(validation, health);
  const readiness = computePackageReadiness({ validation, health });
  return { validation, health, explanation, readiness };
}

export async function createExecutionPackageVersionAction(packageId: string, input: BuildExecutionPackageInput): Promise<ActionResult<ExecutionPackage>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("execution_packages.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPackageOrFail(packageId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const resolved = await resolveSnapshotSources(workspaceId, input);
  if ("error" in resolved) return { success: false, error: resolved.error };
  const versionInput = buildVersionInput(resolved.sources, input.dependencyChecks, input.notes, input.notes, input.reason);

  const result = await getCoreExecutionPackagesService().addVersion(packageId, workspaceId, session.membership.id, versionInput);
  if (!result.success) return { success: false, error: result.error };

  recordPackageTimelineEvent(workspaceId, found.pkg.context.context, snapshotCreatedEvent(found.pkg.metadata.title));
  recordPackageTimelineEvent(workspaceId, found.pkg.context.context, versionCreatedEvent(found.pkg.metadata.title, result.data.versions.length));
  return { success: true, data: result.data };
}

export async function evaluateExecutionPackageAction(packageId: string): Promise<ActionResult<ExecutionPackageResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchPackageOrFail(packageId, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const analysis = analyzePackage(found.pkg);
  return { success: true, data: { package: found.pkg, version: currentVersionOf(found.pkg), validation: analysis.validation, health: analysis.health, explanation: analysis.explanation, readiness: analysis.readiness } };
}

/** A genuine, explicit user transition — distinct from the passive dashboard read `evaluateExecutionPackageAction` performs — so `package_validated` never fires on every page view. */
export async function validateExecutionPackageAction(packageId: string): Promise<ActionResult<ExecutionPackageResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("execution_packages.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchPackageOrFail(packageId, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const analysis = analyzePackage(found.pkg);
  recordPackageTimelineEvent(session.workspace.id, found.pkg.context.context, packageValidatedEvent(found.pkg.metadata.title, analysis.validation.valid));
  return { success: true, data: { package: found.pkg, version: currentVersionOf(found.pkg), validation: analysis.validation, health: analysis.health, explanation: analysis.explanation, readiness: analysis.readiness } };
}

async function setPackageStatusAction(id: string, status: "approved" | "archived"): Promise<ActionResult<ExecutionPackage>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("execution_packages.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPackageOrFail(id, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  if (status === "approved") {
    const analysis = analyzePackage(found.pkg);
    if (!analysis.validation.valid) return { success: false, error: "This execution package has blocking issues and cannot be approved yet." };
  }

  const result = await getCoreExecutionPackagesService().setPackageStatus(id, workspaceId, status, status === "approved" ? session.membership.id : null);
  if (!result.success) return { success: false, error: result.error };
  recordPackageTimelineEvent(workspaceId, result.data.context.context, status === "approved" ? packageApprovedEvent(result.data.metadata.title) : packageArchivedEvent(result.data.metadata.title));
  return { success: true, data: result.data };
}

export async function approveExecutionPackageAction(id: string): Promise<ActionResult<ExecutionPackage>> {
  return setPackageStatusAction(id, "approved");
}

export async function archiveExecutionPackageAction(id: string): Promise<ActionResult<ExecutionPackage>> {
  return setPackageStatusAction(id, "archived");
}

export async function compareExecutionPackageVersionsAction(packageId: string, versionNumberA: number, versionNumberB: number): Promise<ActionResult<ExecutionVersionComparisonResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const found = await fetchPackageOrFail(packageId, session.workspace.id);
  if ("error" in found) return { success: false, error: found.error };

  const versionA = found.pkg.versions.find((v) => v.version_number === versionNumberA);
  const versionB = found.pkg.versions.find((v) => v.version_number === versionNumberB);
  if (!versionA || !versionB) return { success: false, error: "One or both versions could not be found." };

  const validationA = validatePackage({ snapshot: versionA.snapshot });
  const validationB = validatePackage({ snapshot: versionB.snapshot });
  const healthA = computePackageHealthScores(versionA.snapshot);
  const healthB = computePackageHealthScores(versionB.snapshot);

  return { success: true, data: compareExecutionVersions(versionA, versionB, healthA, healthB, validationA.errors.length, validationB.errors.length) };
}

export interface EvaluateExecutionPackagePlatformHealthResult {
  packages: ExecutionPackage[];
  findings: PackageFinding[];
  healthByPackageId: Record<string, PackageHealthScores>;
  readinessByPackageId: Record<string, PackageReadinessResult>;
}

export async function evaluateExecutionPackagePlatformHealthAction(): Promise<ActionResult<EvaluateExecutionPackagePlatformHealthResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const packages = await getCoreExecutionPackagesService().listPackagesForWorkspace(workspaceId, false);

  const validationResultsByPackageId = new Map<string, ReturnType<typeof validatePackage>>();
  const healthByPackageId = new Map<string, PackageHealthScores>();
  const readinessByPackageId = new Map<string, PackageReadinessResult>();
  const driftedPackageIds = new Set<string>();

  for (const pkg of packages) {
    const analysis = analyzePackage(pkg);
    validationResultsByPackageId.set(pkg.id, analysis.validation);
    healthByPackageId.set(pkg.id, analysis.health);
    readinessByPackageId.set(pkg.id, analysis.readiness);

    const version = currentVersionOf(pkg);
    const plan = version.snapshot.operational_plan_id !== null ? await getCoreOperationalPlansService().getPlanById(version.snapshot.operational_plan_id) : null;
    const allocation = version.snapshot.allocation_id !== null ? await getCoreAllocationsService().getAllocationById(version.snapshot.allocation_id) : null;
    const drifted = hasSnapshotDrifted(version.snapshot.captured_at, plan?.updated_at ?? null) || hasSnapshotDrifted(version.snapshot.captured_at, allocation?.updated_at ?? null);
    if (drifted) driftedPackageIds.add(pkg.id);
  }

  const findings = detectExecutionPackageRisks({ packages, validationResultsByPackageId, healthByPackageId, readinessByPackageId, driftedPackageIds });

  return { success: true, data: { packages, findings, healthByPackageId: Object.fromEntries(healthByPackageId), readinessByPackageId: Object.fromEntries(readinessByPackageId) } };
}

/** Adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateExecutionPackagePlatformHealthAction`'s findings into `OperationalRecommendation`s. */
export async function executionPackageRecommendationsForExecutiveDecisions() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];
  const result = await evaluateExecutionPackagePlatformHealthAction();
  if (!result.success) return [];
  return executionPackageFindingsToRecommendations(result.data.findings, result.data.packages, session.workspace.id);
}
