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
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs tracking-wide text-text-muted uppercase">
          <tr>
            <th className="px-5 py-4 font-medium">Name</th>
            <th className="px-5 py-4 font-medium">Partner</th>
            <th className="px-5 py-4 font-medium">Email</th>
            <th className="px-5 py-4 font-medium">Phone</th>
            <th className="px-5 py-4 font-medium">Status</th>
            <th className="px-5 py-4 font-medium">VIP</th>
            <th className="px-5 py-4 font-medium">Tags</th>
            <th className="px-5 py-4 font-medium">Source</th>
            <th className="px-5 py-4 font-medium">Created</th>
            <th className="px-5 py-4 font-medium">Next action</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr
              key={client.id}
              className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-muted/60"
            >
              <td className="px-5 py-4">
                <Link
                  href={`/clients/${client.id}`}
                  className="font-medium tracking-tight text-text hover:text-accent"
                >
                  {client.first_name} {client.last_name}
                </Link>
              </td>
              <td className="px-5 py-4 text-text-muted">{client.partner_name ?? "—"}</td>
              <td className="px-5 py-4 text-text-muted">{client.email}</td>
              <td className="px-5 py-4 text-text-muted">{client.phone ?? "—"}</td>
              <td className="px-5 py-4">
                <ClientStatusBadge status={client.internal_status} />
              </td>
              <td className="px-5 py-4">
                <VipBadge isVip={client.is_vip} />
              </td>
              <td className="px-5 py-4 text-text-muted">
                {client.tags.length > 0 ? client.tags.join(", ") : "—"}
              </td>
              <td className="px-5 py-4 text-text-muted">{client.source ?? "—"}</td>
              <td className="px-5 py-4 text-text-muted">
                {new Date(client.created_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-4 text-text-muted">{nextActionByClientId[client.id] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
