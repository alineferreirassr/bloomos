"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  createExpenseNote,
  getClientById,
  getContract,
  getEventById,
  getExpenseById,
  getExpenseNextAction,
  getNotesByExpenseId,
  getTimelineByExpenseId,
  togglePinNote,
} from "@/lib/data";
import type { Expense } from "@/types/expense";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { NotesSection } from "@/modules/notes/components/NotesSection";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { formatEventDate } from "@/modules/events/dateFormat";
import { formatMoney } from "@/lib/money";
import { isExpenseTerminal } from "@/core/workflows/expenseWorkflow";
import { ExpenseStatusBadge } from "@/modules/finance/components/ExpenseStatusBadge";
import { ExpenseCategoryBadge } from "@/modules/finance/components/ExpenseCategoryBadge";
import { ExpenseActions } from "@/modules/finance/components/ExpenseActions";
import { DocumentsSummarySection } from "@/modules/documents/components/DocumentsSummarySection";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      expense: Expense;
      client: Client | null;
      event: Event | null;
      contract: Contract | null;
      notes: Note[];
      timeline: TimelineActivity[];
      nextAction: string | null;
    };

async function loadExpenseDetail(expenseId: string): Promise<LoadState> {
  try {
    const expense = await getExpenseById(expenseId);
    const [client, event, contract, notes, timeline, nextAction] = await Promise.all([
      expense.client_id ? getClientById(expense.client_id).catch(() => null) : Promise.resolve(null),
      expense.event_id ? getEventById(expense.event_id).catch(() => null) : Promise.resolve(null),
      expense.contract_id ? getContract(expense.contract_id).catch(() => null) : Promise.resolve(null),
      getNotesByExpenseId(expenseId),
      getTimelineByExpenseId(expenseId),
      getExpenseNextAction(expenseId),
    ]);

    return { status: "ready", expense, client, event, contract, notes, timeline, nextAction };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function ExpenseDetailView({ expenseId }: { expenseId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadExpenseDetail(expenseId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  const refetch = () => {
    loadExpenseDetail(expenseId).then(setState);
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
    return <ErrorState message="This expense could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this expense." onRetry={refetch} />;
  }

  const { expense, client, event, contract, notes, timeline, nextAction } = state;
  const notesReadOnly = isExpenseTerminal(expense.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/finance/expenses" className="text-sm text-accent hover:underline">
          ← Back to Expenses
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">{expense.description}</h2>
          <ExpenseStatusBadge status={expense.status} />
          <ExpenseCategoryBadge category={expense.category} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {formatEventDate(expense.transaction_date)}
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
          {contract ? (
            <>
              {" · "}
              <Link href={`/contracts/${contract.id}`} className="text-accent hover:underline">
                {contract.contract_number}
              </Link>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-text">
          {formatMoney(expense.amount_minor, expense.currency)}
          {expense.reimbursable ? <span className="text-text-muted"> · Reimbursable</span> : null}
        </p>

        <div className="mt-4">
          <ExpenseActions expense={expense} onChanged={refetch} />
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
            <h3 className="font-serif text-[17px] font-semibold text-text">Expense Summary</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Status" value={<ExpenseStatusBadge status={expense.status} />} />
              <Field label="Category" value={<ExpenseCategoryBadge category={expense.category} />} />
              <Field label="Amount" value={formatMoney(expense.amount_minor, expense.currency)} />
              <Field label="Currency" value={expense.currency} />
              <Field label="Reference" value={expense.reference} />
              <Field label="Reimbursable" value={expense.reimbursable ? "Yes" : "No"} />
              <Field label="Supplier" value={expense.supplier_id} />
              <Field label="Team member" value={expense.team_member_id} />
              <Field label="Created" value={new Date(expense.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(expense.updated_at).toLocaleDateString()} />
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
              <p className="mt-2 text-sm text-text-muted">No linked client — this is a general business expense.</p>
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
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No linked event — this expense stands on its own.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Contract</h3>
            {contract ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Contract number"
                  value={
                    <Link href={`/contracts/${contract.id}`} className="text-accent hover:underline">
                      {contract.contract_number}
                    </Link>
                  }
                />
                <Field label="Title" value={contract.title} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-text-muted">No linked contract — this expense stands on its own.</p>
            )}
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Dates</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Transaction date" value={formatEventDate(expense.transaction_date)} />
              <Field label="Due date" value={formatEventDate(expense.due_date)} />
              <Field label="Paid" value={expense.paid_at ? new Date(expense.paid_at).toLocaleString() : null} />
              <Field
                label="Reimbursed"
                value={expense.reimbursed_at ? new Date(expense.reimbursed_at).toLocaleString() : null}
              />
              <Field
                label="Archived"
                value={expense.archived_at ? new Date(expense.archived_at).toLocaleString() : null}
              />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <div className="mt-3">
              <NotesSection
                workspaceId={expense.workspace_id}
                ownerType="expense"
                ownerId={expense.id}
                notes={notes}
                onCreateNote={(input) => createExpenseNote(expense.id, input)}
                onTogglePin={togglePinNote}
                readOnly={notesReadOnly}
                onNotesChanged={refetch}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <DocumentsSummarySection
            ownerType="expense"
            ownerId={expense.id}
            newDocumentParams={{ expenseId: expense.id }}
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
              <li>Receipt upload</li>
              <li>Reimbursement proof</li>
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
