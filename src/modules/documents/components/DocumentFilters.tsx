"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/core/enums/documentCategory";
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_LABELS, type DocumentStatus } from "@/core/enums/documentStatus";
import {
  DOCUMENT_VISIBILITIES,
  DOCUMENT_VISIBILITY_LABELS,
  type DocumentVisibility,
} from "@/core/enums/documentVisibility";
import { ALLOWED_FILE_EXTENSIONS } from "@/lib/documentFile";
import { VALID_DOCUMENT_OWNER_TYPES } from "@/modules/documents/schema";
import type { EntityType } from "@/core/enums/entityType";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { DocumentFolder } from "@/types/documentFolder";

export const OWNER_TYPE_LABELS: Record<EntityType, string> = {
  lead: "Lead",
  client: "Client",
  event: "Event",
  contract: "Contract",
  invoice: "Invoice",
  payment: "Payment",
  expense: "Expense",
  document: "Document",
  document_folder: "Folder",
  workspace: "Workspace",
  team_kb_article: "Team Knowledge Base Article",
  client_kb_article: "Client Knowledge Base Article",
  notification: "Notification",
  automation: "Automation",
  inventory: "Inventory Item",
  vendor: "Vendor",
};

export type DocumentSortField = "title" | "uploaded_at" | "updated_at" | "size_bytes" | "expires_at" | "version";
export type DocumentSortDirection = "asc" | "desc";

export interface DocumentFiltersValue {
  search: string;
  ownerType: EntityType | "all";
  ownerId: string;
  category: DocumentCategory | "all";
  status: DocumentStatus | "all";
  visibility: DocumentVisibility | "all";
  extension: string | "all";
  folderId: string | "all";
  uploadedFrom: string;
  uploadedTo: string;
  expiresFrom: string;
  expiresTo: string;
  includeArchived: boolean;
  includeDeleted: boolean;
  latestVersionOnly: boolean;
  sortField: DocumentSortField;
  sortDirection: DocumentSortDirection;
}

export const DEFAULT_DOCUMENT_FILTERS: DocumentFiltersValue = {
  search: "",
  ownerType: "all",
  ownerId: "",
  category: "all",
  status: "all",
  visibility: "all",
  extension: "all",
  folderId: "all",
  uploadedFrom: "",
  uploadedTo: "",
  expiresFrom: "",
  expiresTo: "",
  includeArchived: false,
  includeDeleted: false,
  latestVersionOnly: false,
  sortField: "uploaded_at",
  sortDirection: "desc",
};

interface DocumentFiltersProps {
  value: DocumentFiltersValue;
  onChange: (value: DocumentFiltersValue) => void;
  clients: Client[];
  events: Event[];
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  folders: DocumentFolder[];
}

function ownerOptionsFor(ownerType: EntityType | "all", props: DocumentFiltersProps): { id: string; label: string }[] {
  switch (ownerType) {
    case "client":
      return props.clients.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}` }));
    case "event":
      return props.events.map((e) => ({ id: e.id, label: e.title }));
    case "contract":
      return props.contracts.map((c) => ({ id: c.id, label: c.contract_number }));
    case "invoice":
      return props.invoices.map((i) => ({ id: i.id, label: i.invoice_number }));
    case "payment":
      return props.payments.map((p) => ({ id: p.id, label: p.id }));
    case "expense":
      return props.expenses.map((e) => ({ id: e.id, label: e.description }));
    default:
      return [];
  }
}

export function DocumentFilters(props: DocumentFiltersProps) {
  const { value, onChange, folders } = props;
  const ownerOptions = ownerOptionsFor(value.ownerType, props);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search title, description, file name…"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
          aria-label="Search documents"
          className="lg:col-span-2"
        />
        <Select
          aria-label="Filter by owner type"
          value={value.ownerType}
          onChange={(event) =>
            onChange({ ...value, ownerType: event.target.value as EntityType | "all", ownerId: "" })
          }
        >
          <option value="all">All owner types</option>
          {VALID_DOCUMENT_OWNER_TYPES.map((type) => (
            <option key={type} value={type}>
              {OWNER_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by owner"
          value={value.ownerId}
          disabled={ownerOptions.length === 0}
          onChange={(event) => onChange({ ...value, ownerId: event.target.value })}
        >
          <option value="">{ownerOptions.length === 0 ? "Select an owner type first" : "All owners"}</option>
          {ownerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Filter by category"
          value={value.category}
          onChange={(event) => onChange({ ...value, category: event.target.value as DocumentCategory | "all" })}
        >
          <option value="all">All categories</option>
          {DOCUMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {DOCUMENT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as DocumentStatus | "all" })}
        >
          <option value="all">All statuses</option>
          {DOCUMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {DOCUMENT_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by visibility"
          value={value.visibility}
          onChange={(event) => onChange({ ...value, visibility: event.target.value as DocumentVisibility | "all" })}
        >
          <option value="all">All visibilities</option>
          {DOCUMENT_VISIBILITIES.map((visibility) => (
            <option key={visibility} value={visibility}>
              {DOCUMENT_VISIBILITY_LABELS[visibility]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by extension"
          value={value.extension}
          onChange={(event) => onChange({ ...value, extension: event.target.value })}
        >
          <option value="all">All extensions</option>
          {ALLOWED_FILE_EXTENSIONS.map((extension) => (
            <option key={extension} value={extension}>
              .{extension}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          aria-label="Filter by folder"
          value={value.folderId}
          onChange={(event) => onChange({ ...value, folderId: event.target.value })}
          className="lg:col-span-2"
        >
          <option value="all">All folders</option>
          <option value="">No folder</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name} ({OWNER_TYPE_LABELS[folder.owner_type]})
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort by"
          value={`${value.sortField}:${value.sortDirection}`}
          onChange={(event) => {
            const [sortField, sortDirection] = event.target.value.split(":") as [
              DocumentSortField,
              DocumentSortDirection,
            ];
            onChange({ ...value, sortField, sortDirection });
          }}
          className="lg:col-span-2"
        >
          <option value="uploaded_at:desc">Uploaded: newest first</option>
          <option value="uploaded_at:asc">Uploaded: oldest first</option>
          <option value="updated_at:desc">Updated: newest first</option>
          <option value="updated_at:asc">Updated: oldest first</option>
          <option value="title:asc">Title: A–Z</option>
          <option value="title:desc">Title: Z–A</option>
          <option value="size_bytes:desc">Size: largest first</option>
          <option value="size_bytes:asc">Size: smallest first</option>
          <option value="expires_at:asc">Expiration: soonest first</option>
          <option value="expires_at:desc">Expiration: latest first</option>
          <option value="version:desc">Version: highest first</option>
          <option value="version:asc">Version: lowest first</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="date"
          aria-label="Uploaded from"
          value={value.uploadedFrom}
          onChange={(event) => onChange({ ...value, uploadedFrom: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Uploaded to"
          value={value.uploadedTo}
          onChange={(event) => onChange({ ...value, uploadedTo: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Expires from"
          value={value.expiresFrom}
          onChange={(event) => onChange({ ...value, expiresFrom: event.target.value })}
        />
        <Input
          type="date"
          aria-label="Expires to"
          value={value.expiresTo}
          onChange={(event) => onChange({ ...value, expiresTo: event.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.latestVersionOnly}
            onChange={(event) => onChange({ ...value, latestVersionOnly: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Latest version only
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.includeArchived}
            onChange={(event) => onChange({ ...value, includeArchived: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Show archived
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={value.includeDeleted}
            onChange={(event) => onChange({ ...value, includeDeleted: event.target.checked })}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
          />
          Show deleted
        </label>
      </div>
    </div>
  );
}
