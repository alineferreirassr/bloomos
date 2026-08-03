import Link from "next/link";
import type { Client } from "@/types/client";
import { ClientStatusBadge } from "@/modules/clients/components/ClientStatusBadge";
import { VipBadge } from "@/modules/clients/components/VipBadge";

interface ClientListTableProps {
  clients: Client[];
  nextActionByClientId: Record<string, string | null>;
}

export function ClientListTable({ clients, nextActionByClientId }: ClientListTableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface shadow-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-[var(--z-index-dropdown)] bg-surface">
          <tr>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Name</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Partner</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Email</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Phone</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Status</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">VIP</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Tags</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Source</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Created</th>
            <th className="border-b border-border px-4 py-3 text-[11px] tracking-wide text-text-muted uppercase">Next action</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id} className="transition-colors duration-150 hover:bg-accent-100/40">
              <td className="border-b border-border px-2.5 py-2">
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium text-text hover:text-accent"
                >
                  {client.first_name} {client.last_name}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{client.partner_name ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{client.email}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{client.phone ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2">
                <ClientStatusBadge status={client.internal_status} />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <VipBadge isVip={client.is_vip} />
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {client.tags.length > 0 ? client.tags.join(", ") : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{client.source ?? "—"}</td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {new Date(client.created_at).toLocaleDateString()}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{nextActionByClientId[client.id] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
