"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { getWorkflowsList } from "@/modules/workflow/getWorkflowsList";
import { createWorkflow } from "@/modules/workflow/createWorkflow";
import { cloneWorkflow } from "@/modules/workflow/cloneWorkflow";
import { archiveWorkflow, unarchiveWorkflow } from "@/modules/workflow/archiveWorkflow";
import { getWorkflowSuggestions, type WorkflowSuggestion } from "@/modules/workflow/getWorkflowSuggestions";
import { getWorkflowTemplates } from "@/modules/workflow/getWorkflowTemplates";
import { WorkflowDashboardSection } from "@/modules/workflow/components/WorkflowDashboardSection";
import { AUTOMATION_CATEGORIES, type AutomationCategory } from "@/types/automation";
import type { Workflow, WorkflowStatus, WorkflowTemplate } from "@/types/workflow";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; workflows: Workflow[] };

const STATUS_TONE: Record<WorkflowStatus, BadgeTone> = { draft: "outline", published: "accent", archived: "neutral" };
const STATUS_LABEL: Record<WorkflowStatus, string> = { draft: "Draft", published: "Published", archived: "Archived" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function loadWorkflows(): Promise<LoadState> {
  const result = await getWorkflowsList();
  if (!result.success) return { status: "error", message: result.error };
  return { status: "ready", workflows: result.data };
}

/**
 * The Step 7 Workflow List — every Workflow in this Workspace, with its own
 * status, and the entry point into creating, cloning, and
 * archiving/unarchiving one. Publishing itself only ever happens from
 * inside the Editor (`/workflows/[id]`), never from this list.
 */
export function WorkflowsListView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AutomationCategory>("operations");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WorkflowSuggestion[]>([]);
  const [pendingTriggerNodeId, setPendingTriggerNodeId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  function refresh() {
    setState({ status: "loading" });
    loadWorkflows().then(setState);
  }

  useEffect(() => {
    let cancelled = false;
    loadWorkflows().then((next) => {
      if (!cancelled) setState(next);
    });
    getWorkflowSuggestions().then((result) => {
      if (!cancelled && result.success) setSuggestions(result.data);
    });
    getWorkflowTemplates().then((result) => {
      if (!cancelled && result.success) setTemplates(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreateModal = useCallback(() => {
    setName("");
    setPendingTriggerNodeId(null);
    setPendingTemplateId(null);
    setCreateOpen(true);
  }, []);

  function selectTemplate(template: WorkflowTemplate) {
    setName(template.name);
    setCategory(template.category);
    setPendingTriggerNodeId(null);
    setPendingTemplateId(template.id);
  }

  // Step 14 Command Palette — self-registers the same way every other
  // page's own commands do in this codebase (see `AutomationDashboardView.tsx`,
  // Checkpoint 9): the global `CommandPalette` shell isn't mounted anywhere
  // yet, so these are "found there for free" once it is. "Recent Workflows"
  // jumps straight to the most recently updated one (the list is already
  // sorted newest-first by `getWorkflowsList`), matching how a real user
  // would use that command — not just re-navigating to a page they're
  // already looking at.
  useEffect(() => {
    registerCommand({
      id: "open-workflow-builder",
      label: "Open Workflow Builder",
      group: "Workflows",
      keywords: ["workflow", "automation", "builder"],
      run: () => router.push("/workflows"),
    });
    registerCommand({
      id: "create-workflow",
      label: "Create Workflow",
      group: "Workflows",
      keywords: ["workflow", "new"],
      run: openCreateModal,
    });
    registerCommand({
      id: "recent-workflows",
      label: "Recent Workflows",
      group: "Workflows",
      keywords: ["workflow", "history"],
      run: () => {
        const mostRecent = state.status === "ready" ? state.workflows[0] : undefined;
        router.push(mostRecent ? `/workflows/${mostRecent.id}` : "/workflows");
      },
    });
    registerCommand({
      id: "open-workflow-monitoring-center",
      label: "Open Workflow Monitoring Center",
      group: "Workflows",
      keywords: ["workflow", "monitor", "execution", "errors", "health", "audit", "performance"],
      run: () => router.push("/workflows/monitoring"),
    });
    return () => {
      unregisterCommand("open-workflow-builder");
      unregisterCommand("create-workflow");
      unregisterCommand("recent-workflows");
      unregisterCommand("open-workflow-monitoring-center");
    };
  }, [router, openCreateModal, state]);

  function openSuggestion(suggestion: WorkflowSuggestion) {
    setName(suggestion.name);
    setPendingTriggerNodeId(suggestion.triggerNodeId);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    const result = await createWorkflow(name, category, pendingTriggerNodeId, pendingTemplateId);
    setCreating(false);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    setCreateOpen(false);
    setName("");
    setPendingTriggerNodeId(null);
    setPendingTemplateId(null);
    window.location.href = `/workflows/${result.data.id}`;
  }

  async function handleClone(workflowId: string) {
    setPendingId(workflowId);
    const result = await cloneWorkflow(workflowId);
    setPendingId(null);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      return;
    }
    setToast({ tone: "success", message: `Cloned as "${result.data.metadata.name}".` });
    refresh();
  }

  async function handleArchiveToggle(workflow: Workflow) {
    setPendingId(workflow.id);
    const result = workflow.status === "archived" ? await unarchiveWorkflow(workflow.id) : await archiveWorkflow(workflow.id);
    setPendingId(null);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      return;
    }
    setToast({ tone: "success", message: workflow.status === "archived" ? "Workflow unarchived." : "Workflow archived." });
    refresh();
  }

  return (
    <div>
      <PageHeader
        title="Workflows"
        subtitle="Design what should happen after a real business event — visually. Publishing compiles a Workflow into real Automations; the Automation Engine remains the only thing that ever executes them."
        actions={
          <>
            <Link href="/workflows/monitoring">
              <Button type="button" variant="secondary">
                Monitoring Center
              </Button>
            </Link>
            <Button type="button" onClick={openCreateModal}>
              New Workflow
            </Button>
          </>
        }
      />

      <WorkflowDashboardSection />

      {suggestions.length > 0 ? (
        <LuxuryCard tone="tint" className="mt-4 sm:mt-6">
          <h3 className="font-serif text-[15px] font-semibold text-text">Suggested Workflows</h3>
          <p className="mt-1 text-xs text-text-muted">
            Bloom AI noticed these Triggers have no Automation responding to them yet — a deterministic read of the
            Automation Registry, never a generated guess. Nothing is created until you explicitly approve one below.
          </p>
          <ul className="mt-3 space-y-2">
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.triggerType}
                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{suggestion.name}</p>
                  <p className="truncate text-xs text-text-muted">{suggestion.reason}</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => openSuggestion(suggestion)} className="self-start sm:self-auto">
                  Create from suggestion
                </Button>
              </li>
            ))}
          </ul>
        </LuxuryCard>
      ) : null}

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {state.status === "error" ? <ErrorState message={state.message} onRetry={refresh} /> : null}

        {state.status === "ready" && state.workflows.length === 0 ? (
          <EmptyState
            illustration="generic"
            title="No Workflows yet"
            description="Create one to design your first automated response to a real business event."
          />
        ) : null}

        {state.status === "ready" && state.workflows.length > 0 ? (
          <LuxuryCard className="p-0 overflow-hidden">
            <ul className="divide-y divide-border">
              {state.workflows.map((workflow) => (
                <li key={workflow.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/workflows/${workflow.id}`} className="truncate font-serif text-[15px] font-semibold text-text hover:underline">
                        {workflow.metadata.name}
                      </Link>
                      <Badge tone={STATUS_TONE[workflow.status]}>{STATUS_LABEL[workflow.status]}</Badge>
                      <Badge tone="neutral">{workflow.metadata.category}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-text-muted">
                      {workflow.metadata.description || "No description."} · Updated {formatDateTime(workflow.updatedAt)}
                      {workflow.currentVersion > 0 ? ` · v${workflow.currentVersion}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/workflows/${workflow.id}`}>
                      <Button type="button" variant="secondary">
                        Open
                      </Button>
                    </Link>
                    <Button type="button" variant="ghost" disabled={pendingId === workflow.id} onClick={() => handleClone(workflow.id)}>
                      Clone
                    </Button>
                    <Button type="button" variant="ghost" disabled={pendingId === workflow.id} onClick={() => handleArchiveToggle(workflow)}>
                      {workflow.status === "archived" ? "Unarchive" : "Archive"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </LuxuryCard>
        ) : null}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Workflow">
        <div className="space-y-3">
          {templates.length > 0 ? (
            <div>
              <p className="block text-xs font-medium text-text-muted">Start from a Template (optional)</p>
              <div className="mt-1.5 space-y-1.5">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplate(template)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      pendingTemplateId === template.id ? "border-accent bg-accent/10 text-text" : "border-border text-text-muted hover:border-accent/50"
                    }`}
                  >
                    <span className="font-medium text-text">{template.name}</span>
                    <span className="block text-xs text-text-muted">{template.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <label htmlFor="workflow-name" className="block text-xs font-medium text-text-muted">
              Name
            </label>
            <input
              id="workflow-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Notify on overdue invoice"
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text"
            />
          </div>
          <div>
            <label htmlFor="workflow-category" className="block text-xs font-medium text-text-muted">
              Category
            </label>
            <select
              id="workflow-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as AutomationCategory)}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text"
            >
              {AUTOMATION_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          {createError ? <p className="text-sm text-danger">{createError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? "Creating…" : "Create Workflow"}
            </Button>
          </div>
        </div>
      </Modal>

      {toast ? <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
