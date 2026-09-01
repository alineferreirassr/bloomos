"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createContractNote,
  getClientById,
  getContract,
  getContractExhibitsByContractId,
  getContractNextAction,
  getContractTemplateById,
  getEventById,
  getNotesByContractId,
  getTimelineByContractId,
  togglePinNote,
} from "@/lib/data";
import {
  getContractFinancialSummaryAction,
  type ContractFinancialSummaryView,
} from "@/modules/finance/financeActions";
import type { Contract } from "@/types/contract";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { formatEventDate } from "@/modules/events/dateFormat";
import { CONTRACT_TEMPLATE_CATEGORY_LABELS } from "@/core/enums/contractTemplateCategory";
import { isContractCommercialLocked, isContractFullyLocked } from "@/core/workflows/contractWorkflow";
import { ContractStatusBadge } from "@/modules/contracts/components/ContractStatusBadge";
import { SignatureStatusBadge } from "@/modules/contracts/components/SignatureStatusBadge";
import { ContractActions } from "@/modules/contracts/components/ContractActions";
import { ExhibitsSection } from "@/modules/contracts/components/ExhibitsSection";
import { VersionHistorySection } from "@/modules/contracts/components/VersionHistorySection";
import { ContractDocumentSection } from "@/modules/contracts/components/ContractDocumentSection";
import { formatContractValue } from "@/modules/contracts/mappers";
import { ContractFinanceSummaryCard } from "@/modules/finance/components/ContractFinanceSummaryCard";
import { DocumentsSummarySection } from "@/modules/documents/components/DocumentsSummarySection";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      contract: Contract;
      client: Client | null;
      event: Event | null;
      template: ContractTemplate | null;
      exhibits: ContractExhibit[];
      notes: Note[];
      timeline: TimelineActivity[];
      nextAction: string | null;
      financeSummary: ContractFinancialSummaryView | null;
    };

async function loadContractDetail(contractId: string): Promise<LoadState> {
  try {
    const contract = await getContract(contractId);
    const [client, event, template, exhibits, notes, timeline, nextAction, financeSummaryResult] = await Promise.all([
      getClientById(contract.client_id).catch(() => null),
      contract.event_id ? getEventById(contract.event_id).catch(() => null) : Promise.resolve(null),
      contract.template_id ? getContractTemplateById(contract.template_id).catch(() => null) : Promise.resolve(null),
      getContractExhibitsByContractId(contractId),
      getNotesByContractId(contractId),
      getTimelineByContractId(contractId),
      getContractNextAction(contractId),
      getContractFinancialSummaryAction(contractId),
    ]);
    const financeSummary = financeSummaryResult.data;

    return { status: "ready", contract, client, event, template, exhibits, notes, timeline, nextAction, financeSummary };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function ContractDetailView({ contractId }: { contractId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadContractDetail(contractId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  // Same rationale as EventDetailView/ClientDetailView: keep the current
  // tree mounted while a refetch runs in the background, so local feedback
  // (e.g. quick-action errors) isn't unmounted before the user sees it.
  const refetch = () => {
    loadContractDetail(contractId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This contract could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this contract." onRetry={refetch} />;
  }

  const { contract, client, event, template, exhibits, notes, timeline, nextAction, financeSummary } = state;

  const notesReadOnly = isContractFullyLocked(contract.status);
  const exhibitsReadOnly = isContractCommercialLocked(contract.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-accent hover:underline">
          ← Back to Contracts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">{contract.title}</h2>
          <ContractStatusBadge status={contract.status} />
          <SignatureStatusBadge status={contract.signature_status} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {contract.contract_number}
          {client ? (
            <>
              {" · "}
              <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
                {client.first_name} {client.last_name}
              </Link>
            </>
          ) : null}
          {event ? (
            <>
              {" · "}
              <Link href={`/events/${event.id}`} className="text-accent hover:underline">
                {event.title}
              </Link>
            </>
          ) : null}
          {" · v"}
          {contract.version}
        </p>
        <p className="mt-1 text-sm text-text">
          {formatContractValue(contract.total_value, contract.currency)}
          {contract.deposit_required ? (
            <span className="text-text-muted">
              {" "}
              · Deposit {formatContractValue(contract.deposit_amount, contract.currency)}
            </span>
          ) : null}
          <span className="text-text-muted">
            {" "}
            · Remaining {formatContractValue(contract.remaining_balance, contract.currency)}
          </span>
        </p>

        <div className="mt-4">
          <ContractActions contract={contract} onChanged={refetch} />
        </div>
      </div>

      {nextAction ? (
        <Card className="border-accent/40 bg-accent/5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Next recommended action</p>
          <p className="mt-1 text-sm text-text">{nextAction}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Commercial Summary</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Contract number" value={contract.contract_number} />
              <Field label="Status" value={<ContractStatusBadge status={contract.status} />} />
              <Field label="Signature status" value={<SignatureStatusBadge status={contract.signature_status} />} />
              <Field label="Version" value={`v${contract.version}`} />
              <Field label="Created" value={new Date(contract.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(contract.updated_at).toLocaleDateString()} />
              <Field label="Description" value={contract.description} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Client</h3>
            {client ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Name"
                  value={
                    <Link href={`/clients/${client.id}`} className="text-accent hover:underline">
                      {client.first_name} {client.last_name}
                    </Link>
                  }
                />
                <Field label="Email" value={client.email} />
                <Field label="Phone" value={client.phone} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Client not found.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Event</h3>
            {event ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Title"
                  value={
                    <Link href={`/events/${event.id}`} className="text-accent hover:underline">
                      {event.title}
                    </Link>
                  }
                />
                <Field label="Event date" value={formatEventDate(event.event_date)} />
                <Field label="Location" value={event.location_name} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">
                No linked event — this contract stands on its own.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Dates</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Effective date" value={formatEventDate(contract.effective_date)} />
              <Field label="Expiration date" value={formatEventDate(contract.expiration_date)} />
              <Field label="Sent" value={contract.sent_at ? new Date(contract.sent_at).toLocaleString() : null} />
              <Field label="Viewed" value={contract.viewed_at ? new Date(contract.viewed_at).toLocaleString() : null} />
              <Field label="Signed" value={contract.signed_at ? new Date(contract.signed_at).toLocaleString() : null} />
              <Field label="Declined" value={contract.declined_at ? new Date(contract.declined_at).toLocaleString() : null} />
              <Field label="Cancelled" value={contract.cancelled_at ? new Date(contract.cancelled_at).toLocaleString() : null} />
              <Field label="Archived" value={contract.archived_at ? new Date(contract.archived_at).toLocaleString() : null} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Financial Terms</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Total value" value={formatContractValue(contract.total_value, contract.currency)} />
              <Field label="Currency" value={contract.currency} />
              <Field label="Deposit required" value={contract.deposit_required ? "Yes" : "No"} />
              <Field
                label="Deposit amount"
                value={contract.deposit_required ? formatContractValue(contract.deposit_amount, contract.currency) : null}
              />
              <Field
                label="Remaining balance"
                value={formatContractValue(contract.remaining_balance, contract.currency)}
              />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Template</h3>
            {template ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name" value={template.name} />
                <Field label="Category" value={CONTRACT_TEMPLATE_CATEGORY_LABELS[template.category]} />
                <Field label="Active" value={template.active ? "Yes" : "No"} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No template selected.</p>
            )}
          </Card>

          <ContractDocumentSection contractId={contract.id} />

          <VersionHistorySection contract={contract} />

          <ExhibitsSection
            contractId={contract.id}
            exhibits={exhibits}
            readOnly={exhibitsReadOnly}
            onChanged={refetch}
          />

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={contract.workspace_id}
                ownerType="contract"
                ownerId={contract.id}
                notes={notes}
                onCreateNote={(input) => createContractNote(contract.id, input)}
                onTogglePin={togglePinNote}
                readOnly={notesReadOnly}
                onNotesChanged={refetch}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {client && financeSummary ? (
            <ContractFinanceSummaryCard contractId={contract.id} clientId={client.id} summary={financeSummary} />
          ) : null}
          <DocumentsSummarySection
            ownerType="contract"
            ownerId={contract.id}
            newDocumentParams={{ contractId: contract.id, clientId: contract.client_id }}
          />

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
            <div className="mt-3">
              <Timeline activities={timeline} />
            </div>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Future Integrations</h3>
            <p className="mt-2 text-xs text-text-muted">Not built yet — reserved for upcoming modules.</p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-muted">
              <li>Document rendering &amp; PDF export</li>
              <li>Electronic signature provider</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
