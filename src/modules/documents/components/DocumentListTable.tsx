import Link from "next/link";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";
import { DocumentCategoryBadge } from "@/modules/documents/components/DocumentCategoryBadge";
import { DocumentVisibilityBadge } from "@/modules/documents/components/DocumentVisibilityBadge";
import { formatBytes, formatDocumentDate } from "@/modules/documents/mappers";
import type { DocumentListRow } from "@/modules/documents/components/DocumentsListView";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

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
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            {HEADINGS.map((heading) => (
              <TableHeaderCell key={heading} className="whitespace-nowrap">
                {heading}
              </TableHeaderCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map(({ document, ownerLabel, folderName, nextAction }) => (
            <TableRow key={document.id}>
              <TableCell className="whitespace-nowrap">
                <Link href={`/documents/${document.id}`} className="font-medium text-text hover:text-accent">
                  {document.title}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {document.file_name}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">{ownerLabel}</TableCell>
              <TableCell>
                <DocumentCategoryBadge category={document.category} />
              </TableCell>
              <TableCell>
                <DocumentStatusBadge status={document.status} />
              </TableCell>
              <TableCell>
                <DocumentVisibilityBadge visibility={document.visibility} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                v{document.version}
                {document.is_latest_version ? "" : " (superseded)"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted uppercase">
                {document.file_extension}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {document.size_bytes !== null ? formatBytes(document.size_bytes) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {folderName ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {new Date(document.uploaded_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatDocumentDate(document.expires_at)}
              </TableCell>
              <TableCell className="text-text-muted">{nextAction ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
