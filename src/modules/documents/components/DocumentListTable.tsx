import Link from "next/link";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";
import { DocumentVisibilityBadge } from "@/modules/documents/components/DocumentVisibilityBadge";
import { formatBytes, formatDocumentDate } from "@/modules/documents/mappers";
import type { DocumentListRow } from "@/modules/documents/components/DocumentsListView";

const HEADINGS = [
  "Title",
  "File name",
  "Owner",
  "Category",
  "Status",
  "Visibility",
  "Version",
  "Extension",
  "Size",
  "Folder",
  "Uploaded",
  "Expires",
  "Next action",
];

export function DocumentListTable({ rows }: { rows: DocumentListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            {HEADINGS.map((heading) => (
              <th
                key={heading}
                className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ document, ownerLabel, folderName, nextAction }) => (
            <tr key={document.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4 whitespace-nowrap">
                <Link href={`/documents/${document.id}`} className="font-medium text-text hover:text-accent">
                  {document.title}
                </Link>
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {document.file_name}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">{ownerLabel}</td>
              <td className="px-5 py-4">
                <DocumentCategoryBadge category={document.category} />
              </td>
              <td className="px-5 py-4">
                <DocumentStatusBadge status={document.status} />
              </td>
              <td className="px-5 py-4">
                <DocumentVisibilityBadge visibility={document.visibility} />
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                v{document.version}
                {document.is_latest_version ? "" : " (superseded)"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted uppercase">
                {document.file_extension}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {document.size_bytes !== null ? formatBytes(document.size_bytes) : "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {folderName ?? "—"}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {new Date(document.uploaded_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatDocumentDate(document.expires_at)}
              </td>
              <td className="px-5 py-4 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
