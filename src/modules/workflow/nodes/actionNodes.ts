import { CREATE_TASK_ACTION_ID } from "@/modules/automation/actions/createTaskAction";
import { CREATE_NOTIFICATION_ACTION_ID } from "@/modules/automation/actions/createNotificationAction";
import { CREATE_MEMORY_ACTION_ID } from "@/modules/automation/actions/createMemoryAction";
import { UPDATE_STATUS_ACTION_ID } from "@/modules/automation/actions/updateStatusAction";
import { OPEN_REVIEW_QUEUE_ACTION_ID } from "@/modules/automation/actions/openReviewQueueAction";
import { GENERATE_CONTRACT_DOCUMENT_ACTION_ID } from "@/modules/automation/actions/generateContractDocumentAction";
import { GENERATE_PROPOSAL_DOCUMENT_ACTION_ID } from "@/modules/automation/actions/generateProposalDocumentAction";
import { GENERATE_INVOICE_DOCUMENT_ACTION_ID } from "@/modules/automation/actions/generateInvoiceDocumentAction";
import { GENERATE_WELCOME_GUIDE_DOCUMENT_ACTION_ID } from "@/modules/automation/actions/generateWelcomeGuideDocumentAction";
import { GENERATE_CHECKLIST_DOCUMENT_ACTION_ID } from "@/modules/automation/actions/generateChecklistDocumentAction";
import { CREATE_EVENT_ACTION_ID } from "@/modules/automation/actions/createEventAction";
import { CREATE_INVOICE_ACTION_ID } from "@/modules/automation/actions/createInvoiceAction";
import { CREATE_DISPATCH_ACTION_ID } from "@/modules/automation/actions/createDispatchAction";
import { CREATE_TIMELINE_ENTRY_ACTION_ID } from "@/modules/automation/actions/createTimelineEntryAction";
import { CREATE_EXECUTIVE_DECISION_ACTION_ID } from "@/modules/automation/actions/createExecutiveDecisionAction";
import { ASSIGN_WORKER_ACTION_ID } from "@/modules/automation/actions/assignWorkerAction";
import { ASSIGN_VENDOR_ACTION_ID } from "@/modules/automation/actions/assignVendorAction";
import { GENERATE_DOCUMENT_ACTION_ID } from "@/modules/automation/actions/generateDocumentAction";
import { ADD_RELATIONSHIP_ACTION_ID } from "@/modules/automation/actions/addRelationshipAction";
import { ARCHIVE_ENTITY_ACTION_ID } from "@/modules/automation/actions/archiveEntityAction";
import { DUPLICATE_ENTITY_ACTION_ID } from "@/modules/automation/actions/duplicateEntityAction";
import { DELAY_ACTION_ID } from "@/modules/automation/actions/delayAction";
import type { WorkflowNodeDefinition, WorkflowNodeValidationContext } from "@/types/workflow";

/**
 * The Step 9 built-in Action nodes — each `compileTarget` names a real,
 * already-registered `AutomationActionDefinition.id` from the Automation
 * Engine's own Action Registry (Checkpoint 9), imported as a constant
 * rather than a string literal so a rename there is a compile error here,
 * never a silently-broken Workflow node. This is the concrete proof of
 * this checkpoint's own architecture diagram's last step — "Actions" — a
 * Workflow never defines a new Action, it only arranges the nine that
 * already exist.
 *
 * Checkpoint 13 moved the four Skill-invoking Action nodes (Generate
 * Proposal, Generate Daily Brief, Generate CRM Report, Generate Finance
 * Report) out of this static file — they're now generated dynamically
 * from the real Skill Registry by `skillActionNodes.ts`, so a future 5th
 * Skill gets a Workflow node with zero changes here (Step 9's own "do not
 * hardcode Proposal Generator, CRM Assistant, Finance Assistant, Daily
 * Brief"). This file keeps every Action node that *isn't* a thin wrapper
 * around a Skill.
 */
export function makeActionNode(overrides: Pick<WorkflowNodeDefinition, "id" | "name" | "description" | "icon" | "compileTarget">): WorkflowNodeDefinition {
  return {
    kind: "action",
    category: "action",
    color: "success",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    ...overrides,
  };
}

export const createTaskActionNode = makeActionNode({
  id: "action.create-task",
  name: "Create Task",
  description: "Records a to-do as a Note attached to a real BloomOS record.",
  icon: "ListTodo",
  compileTarget: CREATE_TASK_ACTION_ID,
});

export const createNotificationActionNode = makeActionNode({
  id: "action.create-notification",
  name: "Create Notification",
  description: "Creates an in-app Notification for a Workspace member.",
  icon: "Bell",
  compileTarget: CREATE_NOTIFICATION_ACTION_ID,
});

export const createMemoryActionNode = makeActionNode({
  id: "action.create-memory",
  name: "Create Memory",
  description: "Records a structured AI Memory entry via the shared Memory Layer.",
  icon: "BrainCircuit",
  compileTarget: CREATE_MEMORY_ACTION_ID,
});

export const openReviewQueueActionNode = makeActionNode({
  id: "action.open-review-queue",
  name: "Open Review Queue",
  description: "Flags a real BloomOS record for human review via an in-app Notification.",
  icon: "Eye",
  compileTarget: OPEN_REVIEW_QUEUE_ACTION_ID,
});

export const updateStatusActionNode = makeActionNode({
  id: "action.update-status",
  name: "Update Status",
  description: "Updates an Event's own status field.",
  icon: "RefreshCw",
  compileTarget: UPDATE_STATUS_ACTION_ID,
});

// Checkpoint 12 — Step 14's own "Workflow nodes may include: Generate
// Proposal, Generate Contract, Generate Invoice, Generate Welcome Guide,
// Generate Checklist." Each compiles to its own real Document Compiler
// Action (`generateDocumentActionFactory.ts`) — a genuinely different
// pipeline stage from the dynamically-generated "Generate Proposal" Skill
// node in `skillActionNodes.ts` (that one runs the Proposal Generator
// Skill and produces reviewable JSON; these compile a published Template
// into a real, formatted Document).
export const generateContractDocumentActionNode = makeActionNode({
  id: "action.generate-contract-document",
  name: "Generate Contract",
  description: "Compiles the Workspace's own published Contract Template into a real Document.",
  icon: "FileSignature",
  compileTarget: GENERATE_CONTRACT_DOCUMENT_ACTION_ID,
});

export const generateProposalDocumentActionNode = makeActionNode({
  id: "action.generate-proposal-document",
  name: "Generate Proposal Document",
  description: "Compiles the Workspace's own published Proposal Template into a real Document.",
  icon: "FileStack",
  compileTarget: GENERATE_PROPOSAL_DOCUMENT_ACTION_ID,
});

export const generateInvoiceDocumentActionNode = makeActionNode({
  id: "action.generate-invoice-document",
  name: "Generate Invoice",
  description: "Compiles the Workspace's own published Invoice Template into a real Document.",
  icon: "Receipt",
  compileTarget: GENERATE_INVOICE_DOCUMENT_ACTION_ID,
});

export const generateWelcomeGuideDocumentActionNode = makeActionNode({
  id: "action.generate-welcome-guide-document",
  name: "Generate Welcome Guide",
  description: "Compiles the Workspace's own published Welcome Guide Template into a real Document.",
  icon: "BookOpen",
  compileTarget: GENERATE_WELCOME_GUIDE_DOCUMENT_ACTION_ID,
});

export const generateChecklistDocumentActionNode = makeActionNode({
  id: "action.generate-checklist-document",
  name: "Generate Checklist",
  description: "Compiles the Workspace's own published Checklist Template into a real Document.",
  icon: "ListChecks",
  compileTarget: GENERATE_CHECKLIST_DOCUMENT_ACTION_ID,
});

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — Delay/Wait. Unlike
 * Custom Action/Loop/Merge below, this one has a real `compileTarget`
 * (`delayAction.ts`) — a Delay step really is part of the compiled
 * Automation's own action chain, it just can't actually pause execution
 * yet (see that Action's own doc comment). `durationMinutes` is required
 * so the Simulator's own estimated-duration total means something, even
 * though nothing enforces it at real execution time.
 */
function validateDelayData(context: WorkflowNodeValidationContext): string | null {
  const { durationMinutes } = context.node.data;
  if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return "Set how many minutes this Delay step represents.";
  }
  return null;
}

export const delayActionNode: WorkflowNodeDefinition = {
  ...makeActionNode({
    id: "action.delay",
    name: "Delay",
    description: "Records a planned wait step — completes immediately at real execution time (no background scheduler exists yet).",
    icon: "Hourglass",
    compileTarget: DELAY_ACTION_ID,
  }),
  validate: validateDelayData,
};

/**
 * v2.0 Checkpoint 39 addendum — Loop and Merge, both `compileTarget: null`
 * like Custom Action just below (this file's own established pattern for
 * "a real, nameable canvas concept with no matching runtime engine yet" —
 * see `triggerNodes.ts`'s own header comment on Manual/Timer for the same
 * reasoning). Neither needs a change to `WORKFLOW_NODE_KINDS` or
 * `graphAnalysis.ts`: Merge needs none at all — the graph model already
 * lets any number of edges converge on one downstream node; this node only
 * gives that convergence point its own label and icon on the canvas. Loop
 * genuinely has no backing engine — the Automation Engine only ever runs a
 * flat, non-repeating action chain per Checkpoint 9's own design, so this
 * records repeat intent for planning and Simulation, never a real repeat.
 */
function validateLoopData(context: WorkflowNodeValidationContext): string | null {
  const { iterateOver } = context.node.data;
  if (typeof iterateOver !== "string" || iterateOver.trim().length === 0) {
    return 'Describe what this Loop step would iterate over (e.g. "each assigned Worker").';
  }
  return null;
}

export const loopActionNode: WorkflowNodeDefinition = {
  ...makeActionNode({
    id: "action.loop",
    name: "Loop",
    description: "Records a planned repeat step — no iteration engine exists yet, so this compiles to nothing at real execution time.",
    icon: "RefreshCw",
    compileTarget: null,
  }),
  validate: validateLoopData,
};

export const mergeActionNode = makeActionNode({
  id: "action.merge",
  name: "Merge",
  description: "Labels a point where two or more branches rejoin — purely organizational; the graph already supports this without it.",
  icon: "Link2",
  compileTarget: null,
});

/**
 * A user-authored placeholder step — "a human does something outside
 * BloomOS here" — registered with `compileTarget: null` the same way
 * `trigger.manual`/`trigger.timer` are (see `triggerNodes.ts`'s own header
 * comment). The Compiler's own `if (definition?.compileTarget)` guard
 * already skips a null-target node when building `actionIds`, so a
 * Workflow with a Custom Action step still compiles and publishes fine —
 * it just contributes no real Automation Action to the result. Its value
 * is in the Editor and the Execution Simulator (Step 6): a real, nameable
 * node in the graph for a manual step, previewed in Simulation order
 * alongside every real Action, never silently executed.
 */
function validateCustomActionData(context: WorkflowNodeValidationContext): string | null {
  const { label } = context.node.data;
  if (typeof label !== "string" || label.trim().length === 0) {
    return "This Custom Action needs a short label describing the manual step.";
  }
  return null;
}

export const customActionNode: WorkflowNodeDefinition = {
  ...makeActionNode({
    id: "action.custom",
    name: "Custom Action",
    description: "A manual, user-authored step outside BloomOS's own Actions — nameable, simulated, never auto-executed.",
    icon: "Flag",
    compileTarget: null,
  }),
  validate: validateCustomActionData,
};

// v2.0 Checkpoint 39 — Workflow & Automation Platform's own 11 new Action
// nodes, each `compileTarget` naming one of the 11 new registered Actions
// in `modules/automation/actions/` (Step 3), exactly the same pattern as
// every node above.
export const createEventActionNode = makeActionNode({
  id: "action.create-event",
  name: "Create Event",
  description: "Creates a new Event for a real Client.",
  icon: "CalendarPlus",
  compileTarget: CREATE_EVENT_ACTION_ID,
});

export const createInvoiceActionNode = makeActionNode({
  id: "action.create-invoice",
  name: "Create Invoice",
  description: "Creates a new draft Invoice for a real Client.",
  icon: "Receipt",
  compileTarget: CREATE_INVOICE_ACTION_ID,
});

export const createDispatchActionNode = makeActionNode({
  id: "action.create-dispatch",
  name: "Create Dispatch",
  description: "Creates a new Dispatch Batch from real Dispatch Orders.",
  icon: "Truck",
  compileTarget: CREATE_DISPATCH_ACTION_ID,
});

export const createTimelineEntryActionNode = makeActionNode({
  id: "action.create-timeline-entry",
  name: "Create Timeline Entry",
  description: "Records a custom Timeline activity on a real BloomOS record.",
  icon: "History",
  compileTarget: CREATE_TIMELINE_ENTRY_ACTION_ID,
});

export const createExecutiveDecisionActionNode = makeActionNode({
  id: "action.create-executive-decision",
  name: "Create Executive Decision",
  description: "Raises a real Executive Decision for a human to review and act on.",
  icon: "Gavel",
  compileTarget: CREATE_EXECUTIVE_DECISION_ACTION_ID,
});

export const assignWorkerActionNode = makeActionNode({
  id: "action.assign-worker",
  name: "Assign Worker",
  description: "Assigns a real Worker to an Event, Client, or other assignable record.",
  icon: "HardHat",
  compileTarget: ASSIGN_WORKER_ACTION_ID,
});

export const assignVendorActionNode = makeActionNode({
  id: "action.assign-vendor",
  name: "Assign Vendor",
  description: "Links a real Vendor to an Event as assigned.",
  icon: "Store",
  compileTarget: ASSIGN_VENDOR_ACTION_ID,
});

export const generateDocumentActionNode = makeActionNode({
  id: "action.generate-document",
  name: "Generate Document",
  description: "Compiles any real, published Document Template into a new Document.",
  icon: "FileOutput",
  compileTarget: GENERATE_DOCUMENT_ACTION_ID,
});

export const addRelationshipActionNode = makeActionNode({
  id: "action.add-relationship",
  name: "Add Relationship",
  description: "Creates a real Knowledge Graph relationship between two records.",
  icon: "Link2",
  compileTarget: ADD_RELATIONSHIP_ACTION_ID,
});

export const archiveEntityActionNode = makeActionNode({
  id: "action.archive-entity",
  name: "Archive Entity",
  description: "Archives a real Lead, Client, Event, Contract, Invoice, Expense, Document, Vendor, or Purchase.",
  icon: "Archive",
  compileTarget: ARCHIVE_ENTITY_ACTION_ID,
});

export const duplicateEntityActionNode = makeActionNode({
  id: "action.duplicate-entity",
  name: "Duplicate Entity",
  description: "Duplicates a real Contract, Invoice, or Expense.",
  icon: "Copy",
  compileTarget: DUPLICATE_ENTITY_ACTION_ID,
});

export const actionNodes: WorkflowNodeDefinition[] = [
  createTaskActionNode,
  createNotificationActionNode,
  createMemoryActionNode,
  openReviewQueueActionNode,
  updateStatusActionNode,
  generateContractDocumentActionNode,
  generateProposalDocumentActionNode,
  generateInvoiceDocumentActionNode,
  generateWelcomeGuideDocumentActionNode,
  generateChecklistDocumentActionNode,
  customActionNode,
  createEventActionNode,
  createInvoiceActionNode,
  createDispatchActionNode,
  createTimelineEntryActionNode,
  createExecutiveDecisionActionNode,
  assignWorkerActionNode,
  assignVendorActionNode,
  generateDocumentActionNode,
  addRelationshipActionNode,
  archiveEntityActionNode,
  duplicateEntityActionNode,
  delayActionNode,
  loopActionNode,
  mergeActionNode,
];
