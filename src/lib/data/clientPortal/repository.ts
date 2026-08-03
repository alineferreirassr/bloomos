import type {
  ClientPortalEvent,
  ClientPortalContract,
  ClientPortalInvoice,
  ClientPortalInvoiceWithPayments,
  ClientPortalDocument,
  ClientPortalOverview,
} from "@/types/clientPortal";
import type { ClientPortalTimelineEntry } from "@/types/clientPortalTimeline";
import type { DataResult } from "@/lib/data/result";

/**
 * The single Client Portal read contract — implemented once by the mock
 * repository (filters the existing mock stores by the seeded current
 * client account) and once by the Supabase repository (relies on the new
 * `*_select_client_account` RLS policies as the real enforcement boundary,
 * never independently re-deriving authorization in the query itself
 * beyond what RLS already guarantees). Every function returns only the
 * client-safe projections in `types/clientPortal.ts` — never an internal
 * `Event`/`Contract`/`Invoice`/`Payment`/`Document` record.
 *
 * Deliberately read-only this phase — no create/update/delete surface.
 * See docs/permissions.md's Client Portal MVP section for the full list of
 * fields excluded and why.
 */
export interface ClientPortalRepository {
  getClientPortalOverview(): Promise<ClientPortalOverview>;

  getClientPortalEvents(): Promise<ClientPortalEvent[]>;
  getClientPortalEventById(id: string): Promise<ClientPortalEvent>;

  getClientPortalContracts(): Promise<ClientPortalContract[]>;
  getClientPortalContractById(id: string): Promise<ClientPortalContract>;

  getClientPortalInvoices(): Promise<ClientPortalInvoice[]>;
  getClientPortalInvoiceById(id: string): Promise<ClientPortalInvoiceWithPayments>;

  getClientPortalDocuments(): Promise<ClientPortalDocument[]>;
  getClientPortalDocumentById(id: string): Promise<ClientPortalDocument>;
  /** Exchanges `get_client_document_storage_ref` (Supabase mode) for an actual short-lived signed URL server-side — the UI never receives a raw bucket/path, only this URL. */
  getClientPortalDocumentDownloadUrl(id: string): Promise<DataResult<string>>;

  /** Checkpoint 14, Step 6 — aggregates Proposals/Contracts/Invoices/Payments/Documents/Automation history into one sorted, read-only feed. Never a new source of truth. */
  getClientPortalTimeline(): Promise<ClientPortalTimelineEntry[]>;
}
