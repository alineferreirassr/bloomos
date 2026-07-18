import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/data/clientAccess/supabaseRepository", () => ({
  supabaseClientAccessRepository: {
    getCurrentClientAccountContext: vi.fn(),
  },
}));

import { supabaseClientPortalRepository } from "@/lib/data/clientPortal/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { supabaseClientAccessRepository } from "@/lib/data/clientAccess/supabaseRepository";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  const storageCalls: { bucket: string; path: string; expiresIn: number }[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.eq = chain("eq");
    b.neq = chain("neq");
    b.is = chain("is");
    b.order = chain("order");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(nextResult());
    };
    return b;
  }
  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return nextResult();
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, expiresIn: number) => {
          storageCalls.push({ bucket, path, expiresIn });
          return { data: { signedUrl: `https://signed.example.com/${bucket}/${path}` }, error: null };
        },
      }),
    },
  };
  return { client, calls, rpcCalls, storageCalls };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseClientPortalRepository.getClientPortalEvents", () => {
  it("selects only the client-safe event columns and excludes archived events", async () => {
    const { client, calls } = createMockSupabase([{ data: [{ id: "event_1" }], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const events = await supabaseClientPortalRepository.getClientPortalEvents();

    expect(events).toHaveLength(1);
    const selectCall = calls.find((c) => c.table === "events" && c.method === "select");
    expect(selectCall?.args[0]).not.toMatch(/\*/);
    expect(selectCall?.args[0]).not.toMatch(/budget_min|internal_summary|assigned_owner/);
    const isCall = calls.find((c) => c.table === "events" && c.method === "is");
    expect(isCall?.args).toEqual(["archived_at", null]);
  });
});

describe("supabaseClientPortalRepository.getClientPortalEventById", () => {
  it("throws NotFoundError when RLS returns no row (manipulated/unauthorized id)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseClientPortalRepository.getClientPortalEventById("not-mine")).rejects.toThrow("was not found");
  });
});

describe("supabaseClientPortalRepository.getClientPortalInvoiceById", () => {
  it("fetches the invoice then its own client-safe payment history, excluding internal columns from the select list", async () => {
    const { client, calls } = createMockSupabase([
      { data: { id: "invoice_1" }, error: null },
      { data: [{ id: "payment_1" }], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientPortalRepository.getClientPortalInvoiceById("invoice_1");

    expect(result.payments).toHaveLength(1);
    const paymentSelect = calls.find((c) => c.table === "payments" && c.method === "select");
    expect(paymentSelect?.args[0]).not.toMatch(/reference|notes|document_id/);
  });
});

describe("supabaseClientPortalRepository.getClientPortalDocuments", () => {
  it("derives hasFile from media_asset_id and never returns storage_bucket/storage_path in the select list", async () => {
    const { client, calls } = createMockSupabase([{ data: [{ id: "doc_1", media_asset_id: "media_1" }], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const documents = await supabaseClientPortalRepository.getClientPortalDocuments();

    expect(documents[0].hasFile).toBe(true);
    expect(documents[0]).not.toHaveProperty("storage_bucket");
    expect(documents[0]).not.toHaveProperty("storage_path");
    const selectCall = calls.find((c) => c.table === "documents" && c.method === "select");
    expect(selectCall?.args[0]).not.toMatch(/storage_bucket|storage_path|checksum/);
  });
});

describe("supabaseClientPortalRepository.getClientPortalDocumentDownloadUrl", () => {
  it("exchanges the storage-ref RPC result for a signed URL, never returning the raw bucket/path", async () => {
    const { client, rpcCalls, storageCalls } = createMockSupabase([
      { data: [{ storage_bucket: "media-assets", storage_path: "ws/client/doc/file.pdf" }], error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientPortalRepository.getClientPortalDocumentDownloadUrl("doc_1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe("https://signed.example.com/media-assets/ws/client/doc/file.pdf");
    expect(rpcCalls[0]).toEqual({ name: "get_client_document_storage_ref", args: { p_document_id: "doc_1" } });
    expect(storageCalls[0].bucket).toBe("media-assets");
    expect(storageCalls[0].path).toBe("ws/client/doc/file.pdf");
  });

  it("fails cleanly when the RPC rejects access, never falling through to sign a URL", async () => {
    const { client, storageCalls } = createMockSupabase([]);
    client.rpc = async () => ({ data: null, error: { code: "P0123", message: "You do not have access to this document." } });
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseClientPortalRepository.getClientPortalDocumentDownloadUrl("doc_forbidden");

    expect(result.success).toBe(false);
    expect(storageCalls).toHaveLength(0);
  });
});

describe("supabaseClientPortalRepository.getClientPortalOverview", () => {
  it("aggregates across events/contracts/invoices/documents and includes the client's display name from getCurrentClientAccountContext", async () => {
    vi.mocked(supabaseClientAccessRepository.getCurrentClientAccountContext).mockResolvedValue({
      account: { id: "a1" } as never,
      clientName: "Naomi Whitfield",
      workspaceName: "Amoré Bloom",
    });
    const { client } = createMockSupabase([
      { data: [], error: null }, // events
      { data: [], error: null }, // contracts
      { data: [], error: null }, // invoices
      { data: [], error: null }, // documents
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const overview = await supabaseClientPortalRepository.getClientPortalOverview();

    expect(overview.clientName).toBe("Naomi Whitfield");
    expect(overview.upcomingEvent).toBeNull();
    expect(overview).not.toHaveProperty("expenses");
  });
});
