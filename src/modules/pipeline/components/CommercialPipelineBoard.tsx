"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { getLeads, updateLeadStatus, archiveLead } from "@/lib/data";
import type { Lead } from "@/types/lead";
import {
  COMMERCIAL_COLUMNS,
  COMMERCIAL_PIPELINE_STATUSES,
  columnById,
  type CommercialColumnId,
} from "@/modules/pipeline/constants";
import {
  EMPTY_COMMERCIAL_FILTERS,
  collectAssignees,
  filterCommercialLeads,
  groupLeadsByColumn,
  type CommercialPipelineFilterValues,
} from "@/modules/pipeline/logic";
import { buildQuickActions } from "@/modules/pipeline/quickActions";
import { CommercialPipelineColumn } from "@/modules/pipeline/components/CommercialPipelineColumn";
import { CommercialPipelineFilters } from "@/modules/pipeline/components/CommercialPipelineFilters";
import { CommercialPipelineMobileView } from "@/modules/pipeline/components/CommercialPipelineMobileView";
import { BookLeadConfirmModal } from "@/modules/pipeline/components/BookLeadConfirmModal";
import { AssignTeamModal } from "@/modules/pipeline/components/AssignTeamModal";
import { PendingRecoveryAlert, type PendingRecoveryNotice } from "@/modules/pipeline/components/PendingRecoveryAlert";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; leads: Lead[] };

async function loadBoardLeads(): Promise<LoadState> {
  try {
    const leads = await getLeads({});
    return { status: "ready", leads: leads.filter((l) => COMMERCIAL_PIPELINE_STATUSES.includes(l.status)) };
  } catch {
    return { status: "error" };
  }
}

export function CommercialPipelineBoard() {
  const { can } = useMemberSession();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [filters, setFilters] = useState<CommercialPipelineFilterValues>(EMPTY_COMMERCIAL_FILTERS);
  const [dragError, setDragError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bookLeadTarget, setBookLeadTarget] = useState<Lead | null>(null);
  const [assignTeamTarget, setAssignTeamTarget] = useState<Lead | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecoveryNotice | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const load = () => {
    setLoadState({ status: "loading" });
    loadBoardLeads().then(setLoadState);
  };

  useEffect(() => {
    let cancelled = false;
    loadBoardLeads().then((next) => {
      if (!cancelled) setLoadState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const leads = useMemo(() => (loadState.status === "ready" ? loadState.leads : []), [loadState]);
  const assignees = useMemo(() => collectAssignees(leads), [leads]);
  const filteredLeads = useMemo(() => filterCommercialLeads(leads, filters), [leads, filters]);
  const columns = useMemo(() => groupLeadsByColumn(filteredLeads), [filteredLeads]);

  function patchLead(updated: Lead) {
    setLoadState((current) => {
      if (current.status !== "ready") return current;
      const stillBoarded = COMMERCIAL_PIPELINE_STATUSES.includes(updated.status);
      return {
        status: "ready",
        leads: stillBoarded
          ? current.leads.map((l) => (l.id === updated.id ? updated : l))
          : current.leads.filter((l) => l.id !== updated.id),
      };
    });
  }

  function removeLead(leadId: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current;
      return { status: "ready", leads: current.leads.filter((l) => l.id !== leadId) };
    });
  }

  async function moveLeadToStatus(lead: Lead, targetStatus: Lead["status"]) {
    if (lead.status === targetStatus) return;
    const previous = lead;
    patchLead({ ...lead, status: targetStatus });
    setDragError(null);
    const result = await updateLeadStatus(lead.id, targetStatus);
    if (!result.success) {
      patchLead(previous);
      setDragError(result.error);
      return;
    }
    patchLead(result.data);
  }

  async function handleArchive(lead: Lead) {
    const result = await archiveLead(lead.id);
    if (!result.success) {
      setDragError(result.error);
      return;
    }
    removeLead(lead.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;

    const targetColumnId = over.id as CommercialColumnId;
    if (targetColumnId === "booked") {
      setBookLeadTarget(lead);
      return;
    }

    const targetStatus = columnById(targetColumnId).defaultStatus;
    if (!targetStatus) return;
    moveLeadToStatus(lead, targetStatus);
  }

  function buildActionsFor(lead: Lead) {
    return buildQuickActions(lead, {
      can,
      onOpen: () => window.open(`/leads/${lead.id}`, "_self"),
      onAssignTeam: () => setAssignTeamTarget(lead),
      onScheduleConsultation: () => moveLeadToStatus(lead, "consultation_scheduled"),
      onSendProposal: () => moveLeadToStatus(lead, "proposal_sent"),
      onMoveToWaitingDecision: () => moveLeadToStatus(lead, "waiting_decision"),
      onMarkLost: () => moveLeadToStatus(lead, "lost"),
      onArchive: () => handleArchive(lead),
      onBookLead: () => setBookLeadTarget(lead),
    });
  }

  if (loadState.status === "loading") {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-9 w-full" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="p-4">
        <ErrorState message="Could not load the Commercial Pipeline." onRetry={load} />
      </div>
    );
  }

  const isBoardEmpty = leads.length === 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-serif text-xl font-semibold text-text">Commercial Pipeline</h1>
        <p className="text-sm text-text-muted">Leads move through this board — Booking creates a Client and Event.</p>
      </div>

      {pendingRecovery ? (
        <PendingRecoveryAlert notice={pendingRecovery} onDismiss={() => setPendingRecovery(null)} />
      ) : null}
      {successMessage ? (
        <div role="status" className="rounded-md border border-accent bg-accent/8 px-4 py-2 text-sm text-text">
          {successMessage}
        </div>
      ) : null}
      {dragError ? (
        <p role="alert" className="rounded-md border border-danger/60 bg-danger/10 px-4 py-2 text-sm text-danger">
          {dragError}
        </p>
      ) : null}

      {isBoardEmpty ? (
        <EmptyState
          title="No leads in the Commercial Pipeline"
          description="New Leads will appear here as they come in."
          action={
            can("leads.create") ? (
              <Link href="/leads/new" className="text-sm font-semibold text-accent underline">
                New Lead
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <CommercialPipelineFilters value={filters} onChange={setFilters} assignees={assignees} />

          <div className="hidden md:block" data-testid="commercial-pipeline-desktop">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {COMMERCIAL_COLUMNS.map((column) => (
                  <CommercialPipelineColumn
                    key={column.id}
                    column={column}
                    leads={columns[column.id]}
                    buildActions={buildActionsFor}
                  />
                ))}
              </div>
            </DndContext>
          </div>

          <CommercialPipelineMobileView columns={columns} buildActions={buildActionsFor} />
        </>
      )}

      {bookLeadTarget ? (
        <BookLeadConfirmModal
          lead={bookLeadTarget}
          open
          onClose={() => setBookLeadTarget(null)}
          onBooked={(leadId) => {
            removeLead(leadId);
            setSuccessMessage("Lead booked — Client and Event created.");
          }}
          onPendingRecovery={(leadId, client) => {
            removeLead(leadId);
            setPendingRecovery({ leadId, client });
          }}
        />
      ) : null}

      {assignTeamTarget ? (
        <AssignTeamModal
          lead={assignTeamTarget}
          open
          onClose={() => setAssignTeamTarget(null)}
          onAssigned={(lead) => patchLead(lead)}
        />
      ) : null}
    </div>
  );
}
