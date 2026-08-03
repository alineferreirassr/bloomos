import { getDocumentsManager } from "@/core/documents/manager";
import { getContract, getInvoiceById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import type { DocumentBundleItem, ResolvedDocumentBundleItem } from "@/types/documentPlatform";

/**
 * v2 Checkpoint 44, Step 5 — resolves a Bundle's own by-reference items to
 * a live display summary, reading each item's real owning record at call
 * time. Never caches or persists the result: a Bundle's own storage
 * (`DocumentBundleItem`) holds only `{kind, refId}`, so this is the *only*
 * place a Bundle's UI learns what those references currently point at.
 * Reusing `getDocumentsManager()`/`getContract()`/`getInvoiceById()`/
 * `getProposalsRepository()` — the same accessors the Merge Field Engine's
 * own `proposal`/`finance` domains already call — rather than a second
 * read path into any of those platforms.
 */
export async function resolveBundleItems(items: DocumentBundleItem[]): Promise<ResolvedDocumentBundleItem[]> {
  return Promise.all(items.map(resolveBundleItem));
}

async function resolveBundleItem(item: DocumentBundleItem): Promise<ResolvedDocumentBundleItem> {
  switch (item.kind) {
    case "composed_document": {
      const document = await getDocumentsManager().getComposedDocumentById(item.refId);
      if (!document) return unavailable(item);
      return { item, title: document.metadata.title, subtitle: document.status, available: true };
    }
    case "proposal": {
      const proposal = await getProposalsRepository().getProposalById(item.refId);
      if (!proposal) return unavailable(item);
      return { item, title: `Proposal v${proposal.version}`, subtitle: proposal.status, available: true };
    }
    case "contract": {
      const contract = await getContract(item.refId).catch(() => null);
      if (!contract) return unavailable(item);
      return { item, title: contract.contract_number, subtitle: contract.status, available: true };
    }
    case "invoice": {
      const invoice = await getInvoiceById(item.refId).catch(() => null);
      if (!invoice) return unavailable(item);
      return { item, title: invoice.invoice_number, subtitle: invoice.status, available: true };
    }
  }
}

function unavailable(item: DocumentBundleItem): ResolvedDocumentBundleItem {
  return { item, title: "No longer available", subtitle: null, available: false };
}
