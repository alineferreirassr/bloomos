import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendorDocumentsSection } from "@/modules/vendors/components/VendorDocumentsSection";
import type { MediaAsset } from "@/types/mediaAsset";
import type { DataResult } from "@/lib/data/result";

vi.mock("@/lib/data", () => ({
  getMediaAssetsByOwner: vi.fn(),
  uploadMediaAsset: vi.fn(),
  getMediaAssetDownloadUrl: vi.fn(),
  deleteMediaAsset: vi.fn(),
  restoreMediaAsset: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: "ws_test",
    owner_type: "vendor",
    owner_id: "vendor_1",
    original_filename: "w9-form.pdf",
    stored_filename: "w9-form.pdf",
    storage_bucket: "media-assets",
    storage_path: "ws_test/vendor/vendor_1/asset_1/v1/w9-form.pdf",
    mime_type: "application/pdf",
    extension: "pdf",
    file_size: 204_800,
    checksum: "abc123",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: "Amoré Bloom Team",
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
    ...overrides,
  };
}

function ok<T>(data: T): DataResult<T> {
  return { success: true, data };
}

function fail(error: string): DataResult<never> {
  return { success: false, error };
}

function makeFile(name: string, type: string, content = "hello") {
  return new File([content], name, { type });
}

describe("VendorDocumentsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows a loading state before documents resolve", () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockReturnValue(new Promise(() => {}));

    const { container } = render(<VendorDocumentsSection vendorId="vendor_1" />);

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows the Vendor-specific empty state when there are no documents", async () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    expect(screen.getByText("Upload the first file for this Vendor.")).toBeInTheDocument();
  });

  it("shows an error state with retry when loading fails, and retry re-fetches", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockRejectedValueOnce(new Error("boom"));

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    expect(await screen.findByText(/could not load this vendor's documents/i)).toBeInTheDocument();

    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValueOnce([makeAsset()]);
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("w9-form.pdf")).toBeInTheDocument();
  });

  it("renders a populated document list with type, size, and date", async () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([
      makeAsset({ original_filename: "insurance-cert.pdf", mime_type: "application/pdf", file_size: 1_048_576 }),
    ]);

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    expect(await screen.findByText("insurance-cert.pdf")).toBeInTheDocument();
    expect(screen.getByText(/application\/pdf/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/1\/1\/2026/)).toBeInTheDocument();
  });

  it("passes owner type 'vendor' and the vendor id through to getMediaAssetsByOwner", async () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);

    render(<VendorDocumentsSection vendorId="vendor_42" />);

    await screen.findByText("No documents yet");
    expect(dataLayer.getMediaAssetsByOwner).toHaveBeenCalledWith("vendor", "vendor_42", { includeArchived: true });
  });

  it("uploads a valid file successfully and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeAsset({ original_filename: "new-file.pdf" })]);
    vi.mocked(dataLayer.uploadMediaAsset).mockResolvedValue(ok(makeAsset({ original_filename: "new-file.pdf" })));

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("No documents yet");
    const input = document.getElementById("vendor_document_upload") as HTMLInputElement;
    await user.upload(input, makeFile("new-file.pdf", "application/pdf"));

    await waitFor(() =>
      expect(dataLayer.uploadMediaAsset).toHaveBeenCalledWith(
        expect.objectContaining({ ownerType: "vendor", ownerId: "vendor_1", originalFilename: "new-file.pdf" }),
      ),
    );
    expect(await screen.findByText("new-file.pdf")).toBeInTheDocument();
  });

  it("blocks an unsupported file type before calling uploadMediaAsset", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("No documents yet");
    const input = document.getElementById("vendor_document_upload") as HTMLInputElement;
    await user.upload(input, makeFile("installer.exe", "application/octet-stream"));

    expect(await screen.findByText(/not supported/i)).toBeInTheDocument();
    expect(dataLayer.uploadMediaAsset).not.toHaveBeenCalled();
  });

  it("blocks an oversized file before calling uploadMediaAsset", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("No documents yet");
    const oversizedFile = makeFile("huge.png", "image/png");
    Object.defineProperty(oversizedFile, "size", { value: 30 * 1024 * 1024 });
    const input = document.getElementById("vendor_document_upload") as HTMLInputElement;
    await user.upload(input, oversizedFile);

    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
    expect(dataLayer.uploadMediaAsset).not.toHaveBeenCalled();
  });

  it("shows an error when upload fails, and does not add the document to the list", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.uploadMediaAsset).mockResolvedValue(fail("Storage is temporarily unavailable."));

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("No documents yet");
    const input = document.getElementById("vendor_document_upload") as HTMLInputElement;
    await user.upload(input, makeFile("doc.pdf", "application/pdf"));

    expect(await screen.findByText("Storage is temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByText("No documents yet")).toBeInTheDocument();
  });

  it("disables the Upload button while an upload is in progress, preventing a double upload", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    let resolveUpload!: (result: DataResult<MediaAsset>) => void;
    vi.mocked(dataLayer.uploadMediaAsset).mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("No documents yet");
    const input = document.getElementById("vendor_document_upload") as HTMLInputElement;
    await user.upload(input, makeFile("doc.pdf", "application/pdf"));

    await waitFor(() => expect(screen.getByRole("button", { name: /uploading/i })).toBeDisabled());
    expect(dataLayer.uploadMediaAsset).toHaveBeenCalledTimes(1);

    resolveUpload(ok(makeAsset()));
  });

  it("opens a document using the central download-URL API", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([makeAsset({ original_filename: "contract.pdf" })]);
    vi.mocked(dataLayer.getMediaAssetDownloadUrl).mockResolvedValue(
      ok({ url: "https://signed.example/contract.pdf", expiresAt: "2026-01-01T13:00:00.000Z" }),
    );
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("contract.pdf");
    await user.click(screen.getByRole("button", { name: /open file: contract\.pdf/i }));

    await waitFor(() => expect(dataLayer.getMediaAssetDownloadUrl).toHaveBeenCalledWith("asset_1"));
    expect(windowOpenSpy).toHaveBeenCalledWith("https://signed.example/contract.pdf", "_blank", "noopener,noreferrer");

    windowOpenSpy.mockRestore();
  });

  it("archives a document after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner)
      .mockResolvedValueOnce([makeAsset({ original_filename: "old-cert.pdf" })])
      .mockResolvedValueOnce([makeAsset({ original_filename: "old-cert.pdf", archived_at: "2026-01-02T00:00:00.000Z" })]);
    vi.mocked(dataLayer.deleteMediaAsset).mockResolvedValue(ok(makeAsset({ archived_at: "2026-01-02T00:00:00.000Z" })));

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("old-cert.pdf");
    await user.click(screen.getByRole("button", { name: /archive file: old-cert\.pdf/i }));

    expect(await screen.findByRole("dialog", { name: /archive this file/i })).toBeInTheDocument();
    expect(dataLayer.deleteMediaAsset).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.deleteMediaAsset).toHaveBeenCalledWith("asset_1"));
    expect(await screen.findByText("Archived")).toBeInTheDocument();
  });

  it("cancels an archive confirmation without archiving", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([makeAsset({ original_filename: "keep-me.pdf" })]);

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("keep-me.pdf");
    await user.click(screen.getByRole("button", { name: /archive file: keep-me\.pdf/i }));
    await screen.findByRole("dialog", { name: /archive this file/i });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(dataLayer.deleteMediaAsset).not.toHaveBeenCalled();
  });

  it("retains the document when archiving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([makeAsset({ original_filename: "stubborn.pdf" })]);
    vi.mocked(dataLayer.deleteMediaAsset).mockResolvedValue(fail("Could not archive this file."));

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("stubborn.pdf");
    await user.click(screen.getByRole("button", { name: /archive file: stubborn\.pdf/i }));
    await screen.findByRole("dialog", { name: /archive this file/i });
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText("Could not archive this file.")).toBeInTheDocument();
    expect(screen.getByText("stubborn.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("restores an archived document", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner)
      .mockResolvedValueOnce([makeAsset({ original_filename: "restorable.pdf", archived_at: "2026-01-02T00:00:00.000Z" })])
      .mockResolvedValueOnce([makeAsset({ original_filename: "restorable.pdf", archived_at: null })]);
    vi.mocked(dataLayer.restoreMediaAsset).mockResolvedValue(ok(makeAsset({ archived_at: null })));

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("restorable.pdf");
    await user.click(screen.getByRole("button", { name: /restore file: restorable\.pdf/i }));

    await waitFor(() => expect(dataLayer.restoreMediaAsset).toHaveBeenCalledWith("asset_1"));
    expect(await screen.findByRole("button", { name: /archive file: restorable\.pdf/i })).toBeInTheDocument();
  });

  it("has no rename or edit-metadata affordance (not supported by the Media Asset system)", async () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([makeAsset()]);

    render(<VendorDocumentsSection vendorId="vendor_1" />);

    await screen.findByText("w9-form.pdf");
    expect(screen.queryByRole("button", { name: /rename/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit/i })).not.toBeInTheDocument();
  });

  it("contains no direct Supabase import", () => {
    const source = readFileSync(path.resolve(__dirname, "VendorDocumentsSection.tsx"), "utf-8");
    expect(source).not.toMatch(/from ["']@\/lib\/supabase/);
    expect(source).not.toMatch(/createBrowserClient|createSupabaseClient/);
  });

  it("contains no direct Storage import or call", () => {
    const source = readFileSync(path.resolve(__dirname, "VendorDocumentsSection.tsx"), "utf-8");
    expect(source).not.toMatch(/\.storage\.from\(/);
    expect(source).not.toMatch(/createSignedUrl/);
  });

  it("does not introduce a Vendor-only Document/Media store", () => {
    const source = readFileSync(path.resolve(__dirname, "VendorDocumentsSection.tsx"), "utf-8");
    expect(source).not.toMatch(/mediaAssetsStore|documentsStore|DocumentStore|MediaStore/);
    expect(source).toMatch(/from ["']@\/lib\/data["']/);
  });
});
