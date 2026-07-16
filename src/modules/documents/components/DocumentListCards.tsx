import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DocumentStatusBadge } from "@/modules/documents/components/DocumentStatusBadge";
import { DocumentVisibilityBadge } from "@/modules/documents/components/DocumentVisibilityBadge";
import { formatBytes } from "@/modules/documents/mappers";
import type { DocumentListRow } from "@/modules/documents/components/DocumentsListView";

export function DocumentListCards({ rows }: { rows: DocumentListRow[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ document, ownerLabel, nextAction }) => (
        <Link key={document.id} href={`/documents/${document.id}`} className="block">
          <Card className="transition-colors duration-150 hover:border-accent/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium tracking-tight text-text">{document.title}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">{document.file_name}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">{ownerLabel}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <DocumentStatusBadge status={document.status} />
                <DocumentVisibilityBadge visibility={document.visibility} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>v{document.version}</span>
              <span className="uppercase">{document.file_extension}</span>
              <span>{formatBytes(document.size_bytes)}</span>
            </div>
            {nextAction ? <p className="mt-2 text-xs text-accent">{nextAction}</p> : null}
          </Card>
        </Link>
      ))}
    </div>
  );
}
