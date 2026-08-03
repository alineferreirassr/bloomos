import type { StorageProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

/**
 * v2 Checkpoint 43 — a real `StorageProvider` implementation against the
 * real Google Drive REST API. Plain `fetch`, no `googleapis` dependency,
 * same reasoning as the other Checkpoint 43 adapters. Every uploaded file
 * is placed in `folderId` (a connection-config value the workspace picks
 * at connect time) — BloomOS's own DAM/Document metadata and permissions
 * remain authoritative; this only stores bytes and reports back an
 * external id + shareable url.
 *
 * Connection is unverified in this environment — no OAuth client is
 * configured, so no real file has ever been uploaded. See
 * docs/storage-integration.md.
 */
export class GoogleDriveProvider implements StorageProvider {
  readonly providerId = "google-drive";
  readonly capabilities: ProviderCapability[] = ["storage", "oauth"];

  constructor(
    private readonly accessToken: string,
    private readonly folderId: string | null = null,
  ) {}

  private authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/about?fields=user`, { headers: this.authHeader() });
      if (!response.ok) throw new Error(`Google Drive API error ${response.status}`);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async uploadFile(params: { fileName: string; mimeType: string; content: Blob }): Promise<{ externalId: string; url: string }> {
    const metadata = { name: params.fileName, ...(this.folderId ? { parents: [this.folderId] } : {}) };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", params.content, params.fileName);

    const response = await fetch(`${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,webViewLink`, {
      method: "POST",
      headers: this.authHeader(),
      body: form,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Google Drive upload error ${response.status}: ${body.slice(0, 200)}`);
    }
    const result = (await response.json()) as { id: string; webViewLink: string };
    return { externalId: result.id, url: result.webViewLink };
  }

  async downloadFile(externalId: string): Promise<{ content: Blob; mimeType: string }> {
    const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${externalId}?alt=media`, { headers: this.authHeader() });
    if (!response.ok) throw new Error(`Google Drive download error ${response.status}`);
    const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
    const content = await response.blob();
    return { content, mimeType };
  }

  async deleteFile(externalId: string): Promise<{ deleted: boolean }> {
    const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${externalId}`, { method: "DELETE", headers: this.authHeader() });
    if (!response.ok && response.status !== 404) throw new Error(`Google Drive delete error ${response.status}`);
    return { deleted: true };
  }

  async listFiles(params: { folderId?: string; cursor?: string }): Promise<{ items: Array<{ externalId: string; name: string }>; nextCursor: string | null }> {
    const folderId = params.folderId ?? this.folderId;
    const query = new URLSearchParams({ fields: "nextPageToken,files(id,name)" });
    if (folderId) query.set("q", `'${folderId}' in parents`);
    if (params.cursor) query.set("pageToken", params.cursor);
    const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?${query.toString()}`, { headers: this.authHeader() });
    if (!response.ok) throw new Error(`Google Drive list error ${response.status}`);
    const result = (await response.json()) as { files: Array<{ id: string; name: string }>; nextPageToken?: string };
    return { items: result.files.map((file) => ({ externalId: file.id, name: file.name })), nextCursor: result.nextPageToken ?? null };
  }
}
