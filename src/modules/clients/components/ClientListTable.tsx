import Link from "next/link";
import type { Client } from "@/types/client";
import { ClientStatusBadge } from "@/modules/clients/components/ClientStatusBadge";
import { VipBadge } from "@/modules/clients/components/VipBadge";

interface ClientListTableProps {
  clients: Client[];
  nextActionByClientId: Record<string, string | null>;
}

/* Relationships/CRM visual pass — same premium editorial recipe as Leads:
   quiet row dividers, comfortable height, strong primary identity. Column
   count trimmed from 10 to 6 by combining Name+Partner into one identity
   cell, Email+Phone into one contact cell, and Status+VIP into one badge
   group — no field is deleted, "Created" moves to the detail page only
   (pure admin metadata, not needed to scan who needs attention). Same
   data, same links/actions as before. */
export function ClientListTable({ clients, nextActionByClientId }: ClientListTableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr className="border-b border-border/70">
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Client</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Contact</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Status</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Tags</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Source</th>
            <th className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">Next action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {clients.map((client) => (
            <tr key={client.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4">
                <Link
                  href={`/clients/${client.id}`}
                  className="text-[15px] font-medium text-text hover:text-accent"
                >
                  {client.first_name} {client.last_name}
                </Link>
                {client.partner_name ? <p className="mt-0.5 text-xs text-text-muted">& {client.partner_name}</p> : null}
              </td>
              <td className="px-5 py-4 text-text-muted">
                <p>{client.email}</p>
                {client.phone ? <p className="mt-0.5 text-xs">{client.phone}</p> : null}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ClientStatusBadge status={client.internal_status} />
                  <VipBadge isVip={client.is_vip} />
                </div>
              </td>
              <td className="px-5 py-4 text-text-muted">
                {client.tags.length > 0 ? client.tags.join(", ") : "—"}
              </td>
              <td className="px-5 py-4 text-text-muted">{client.source ?? "—"}</td>
              <td className="px-5 py-4 text-text-muted">{nextActionByClientId[client.id] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
