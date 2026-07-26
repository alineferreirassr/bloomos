import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Client } from "@/types/client";

interface ClientSectionProps {
  client: Client;
}

/** Read-only — a link to the real Client record for anything deeper (edit, full history), never a second place that edits Client fields. */
export function ClientSection({ client }: ClientSectionProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Client</h3>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-text-muted">Name</dt>
          <dd className="text-text">
            <Link href={`/clients/${client.id}`} className="hover:text-accent hover:underline">
              {client.first_name} {client.last_name}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Email</dt>
          <dd className="text-text">{client.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Phone</dt>
          <dd className="text-text">{client.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Address</dt>
          <dd className="text-text">{client.address ? `${client.address}${client.city ? `, ${client.city}` : ""}` : "—"}</dd>
        </div>
      </dl>
    </Card>
  );
}
