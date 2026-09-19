import Link from "next/link";
import type { Client } from "@/types/client";
import { ClientStatusBadge } from "@/modules/clients/components/ClientStatusBadge";
import { VipBadge } from "@/modules/clients/components/VipBadge";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

interface ClientListTableProps {
  clients: Client[];
  nextActionByClientId: Record<string, string | null>;
}

// GLOBAL-VISUAL-04R — deep control migration: rebuilt on the shared
// Table primitive (see LeadListTable.tsx for the full rationale). Column
// set (Client/Contact/Status/Tags/Source/Next action) and all data/links
// unchanged from the prior "Relationships/CRM visual pass" trim.
export function ClientListTable({ clients, nextActionByClientId }: ClientListTableProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>Client</TableHeaderCell>
            <TableHeaderCell>Contact</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Tags</TableHeaderCell>
            <TableHeaderCell>Source</TableHeaderCell>
            <TableHeaderCell>Next action</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link
                  href={`/clients/${client.id}`}
                  className="text-[15px] font-medium text-text hover:text-accent"
                >
                  {client.first_name} {client.last_name}
                </Link>
                {client.partner_name ? <p className="mt-0.5 text-xs text-text-muted">& {client.partner_name}</p> : null}
              </TableCell>
              <TableCell className="text-text-muted">
                <p>{client.email}</p>
                {client.phone ? <p className="mt-0.5 text-xs">{client.phone}</p> : null}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ClientStatusBadge status={client.internal_status} />
                  <VipBadge isVip={client.is_vip} />
                </div>
              </TableCell>
              <TableCell className="text-text-muted">
                {client.tags.length > 0 ? client.tags.join(", ") : "—"}
              </TableCell>
              <TableCell className="text-text-muted">{client.source ?? "—"}</TableCell>
              <TableCell className="text-text-muted">{nextActionByClientId[client.id] ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
