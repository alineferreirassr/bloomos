"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getClients,
  getContracts,
  getDashboardMetrics,
  getDocumentFolders,
  getDocumentNextAction,
  getDocuments,
  getEvents,
  getExpenses,
  getInvoices,
  getPayments,
  type DashboardMetric,
} from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { Document } from "@/types/document";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { DocumentFolder } from "@/types/documentFolder";
import type { EntityType } from "@/core/enums/entityType";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import {
  DocumentFilters,
  DEFAULT_DOCUMENT_FILTERS,
  OWNER_TYPE_LABELS,
  type DocumentFiltersValue,
} from "@/modules/documents/components/DocumentFilters";
import { DocumentListTable } from "@/modules/documents/components/DocumentListTable";
import { DocumentListCards } from "@/modules/documents/components/DocumentListCards";
import { NewFolderModal } from "@/modules/documents/components/NewFolderModal";

export interface DocumentListRow {
  document: Document;
  ownerLabel: string;
  folderName: string | null;
  nextAction: string | null;
}

interface Lookups {
  clients: Client[];
  events: Event[];
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  folders: DocumentFolder[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: DocumentListRow[]; lookups: Lookups; summaryCards: DashboardMetric[] };

const SUMMARY_LABELS = [
  "Total Documents",
  "Documents Uploaded This Month",
  "Storage Used",
  "Expiring Documents",
  "Expired Documents",
  "Archived Documents",
  "Client-visible Documents",
  "Team-visible Documents",
  "Documents Missing Category",
  "Documents Missing Folder",
];

function ownerLabelFor(document: Document, lookups: Lookups): string {
  const typeLabel = OWNER_TYPE_LABELS[document.owner_type];
  switch (document.owner_type) {
    case "client": {
      const client = lookups.clients.find((c) => c.id === document.owner_id);
      return client ? `${client.first_name} ${client.last_name}` : typeLabel;
    }
    case "event": {
      const event = lookups.events.find((e) => e.id === document.owner_id);
      return event ? event.title : typeLabel;
    }
    case "contract": {
      const contract = lookups.contracts.find((c) => c.id === document.owner_id);
      return contract ? contract.contract_number : typeLabel;
    }
    case "invoice": {
      const invoice = lookups.invoices.find((i) => i.id === document.owner_id);
      return invoice ? invoice.invoice_number : typeLabel;
    }
    case "payment": {
      const payment = lookups.payments.find((p) => p.id === document.owner_id);
      if (!payment) return typeLabel;
      return payment.reference ? `Payment ${payment.reference}` : `Payment on ${payment.transaction_date}`;
    }
    case "expense": {
      const expense = lookups.expenses.find((e) => e.id === document.owner_id);
      return expense ? expense.description : typeLabel;
    }
    case "workspace":
    default:
      return "Workspace";
  }
}

function directionMultiplier(direction: DocumentFiltersValue["sortDirection"]): number {
  return direction === "asc" ? 1 : -1;
}

async function loadDocumentsFor(filters: DocumentFiltersValue): Promise<LoadState> {
  try {
    const [documents, clients, events, contracts, invoices, payments, expenses, folders, metrics] = await Promise.all([
      getDocuments({
        search: filters.search,
        ownerType: filters.ownerType,
        ownerId: filters.ownerId || undefined,
        category: filters.category,
        status: filters.status,
        visibility: filters.visibility,
        extension: filters.extension === "all" ? undefined : filters.extension,
        folderId: filters.folderId === "all" ? undefined : filters.folderId === "" ? null : filters.folderId,
        uploadedFrom: filters.uploadedFrom || undefined,
        uploadedTo: filters.uploadedTo || undefined,
        expiresFrom: filters.expiresFrom || undefined,
        expiresTo: filters.expiresTo || undefined,
        includeArchived: filters.includeArchived,
        includeDeleted: filters.includeDeleted,
        latestVersionOnly: filters.latestVersionOnly,
        sortBy: filters.sortField,
        sortDirection: filters.sortDirection,
      }),
      getClients({ includeArchived: true }),
      getEvents({ includeArchived: true }),
      getContracts({ includeArchived: true }),
      getInvoices({ includeArchived: true }),
      getPayments({}),
      getExpenses({ includeArchived: true }),
      getDocumentFolders({ includeArchived: true }),
      getDashboardMetrics(),
    ]);

    const lookups: Lookups = { clients, events, contracts, invoices, payments, expenses, folders };
    const foldersById = new Map(folders.map((folder) => [folder.id, folder]));

    const rows = await Promise.all(
      documents.map(async (document) => ({
        document,
        ownerLabel: ownerLabelFor(document, lookups),
        folderName: document.folder_id ? (foldersById.get(document.folder_id)?.name ?? null) : null,
        nextAction: await getDocumentNextAction(document.id),
      })),
    );

    const direction = directionMultiplier(filters.sortDirection);
    if (filters.sortField !== "uploaded_at") {
      // getDocuments already sorts server-side; re-sort defensively only when the field can't be
      // trusted to have been applied identically (kept for parity with other list views' pattern).
      rows.sort((a, b) => {
        switch (filters.sortField) {
          case "title":
            return direction * a.document.title.localeCompare(b.document.title);
          case "size_bytes":
            return direction * ((a.document.size_bytes ?? 0) - (b.document.size_bytes ?? 0));
          case "version":
            return direction * (a.document.version - b.document.version);
          case "expires_at":
            return direction * (a.document.expires_at ?? "").localeCompare(b.document.expires_at ?? "");
          case "updated_at":
          default:
            return direction * a.document.updated_at.localeCompare(b.document.updated_at);
        }
      });
    }

    const byLabel = new Map(metrics.map((m) => [m.label, m]));
    const summaryCards = SUMMARY_LABELS.map((label) => byLabel.get(label)).filter(
      (m): m is DashboardMetric => m !== undefined,
    );

    return { status: "ready", rows, lookups, summaryCards };
  } catch {
    return { status: "error" };
  }
}

interface DocumentsListViewProps {
  /** Prefills owner/folder filters when arriving from a Client/Event/Contract/etc.'s "View Documents" quick action. */
  initialOwnerType?: EntityType;
  initialOwnerId?: string;
  initialFolderId?: string;
}

export function DocumentsListView({ initialOwnerType, initialOwnerId, initialFolderId }: DocumentsListViewProps = {}) {
  const initialFilters: DocumentFiltersValue = {
    ...DEFAULT_DOCUMENT_FILTERS,
    ownerType: initialOwnerType ?? DEFAULT_DOCUMENT_FILTERS.ownerType,
    ownerId: initialOwnerId ?? DEFAULT_DOCUMENT_FILTERS.ownerId,
    folderId: initialFolderId ?? DEFAULT_DOCUMENT_FILTERS.folderId,
  };
  const [filters, setFilters] = useState<DocumentFiltersValue>(initialFilters);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDocumentsFor(filters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltersChange = (next: DocumentFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadDocumentsFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadDocumentsFor(filters).then(setState);
  };

  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_DOCUMENT_FILTERS);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Documents</h2>
          <p className="mt-1 text-sm text-text-muted">
            The shared file system for BloomOS. {getDataPersistenceMessage()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setNewFolderOpen(true)}>
            New Folder
          </Button>
          <Link href="/documents/new">
            <Button>Add Document</Button>
          </Link>
        </div>
      </div>

      {state.status === "ready" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {state.summaryCards.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {state.status === "ready" ? (
          <DocumentFilters
            value={filters}
            onChange={handleFiltersChange}
            clients={state.lookups.clients}
            events={state.lookups.events}
            contracts={state.lookups.contracts}
            invoices={state.lookups.invoices}
            payments={state.lookups.payments}
            expenses={state.lookups.expenses}
            folders={state.lookups.folders}
          />
        ) : (
          <DocumentFilters
            value={filters}
            onChange={handleFiltersChange}
            clients={[]}
            events={[]}
            contracts={[]}
            invoices={[]}
            payments={[]}
            expenses={[]}
            folders={[]}
          />
        )}
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load documents." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No documents match these filters" : "No documents yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New documents you add will show up here."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/documents/new">
                  <Button>Add Document</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <DocumentListTable rows={state.rows} />
            <DocumentListCards rows={state.rows} />
          </>
        )}
      </div>

      <Card className="mt-6 border-accent/30 bg-accent/5">
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text">Visibility is presentation-only in this phase.</span> Access
          rules (who can actually see a Client- or Team-visible document) will be enforced later by
          authentication and Supabase Row-Level Security — see <code>docs/permissions.md</code>.
        </p>
      </Card>

      <NewFolderModal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} />
    </div>
  );
}
