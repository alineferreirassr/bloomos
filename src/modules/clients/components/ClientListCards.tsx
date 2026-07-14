import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Client } from "@/types/client";
import { ClientStatusBadge } from "@/modules/clients/components/ClientStatusBadge";
import { VipBadge } from "@/modules/clients/components/VipBadge";

interface ClientListCardsProps {
  clients: Client[];
  nextActionByClientId: Record<string, string | null>;
}

export function ClientListCards({ clients, nextActionByClientId }: ClientListCardsProps) {
  return (
    <div className="space-y-3 md:hidden">
      {clients.map((client) => {
        const nextAction = nextActionByClientId[client.id];
        return (
          <Link key={client.id} href={`/clients/${client.id}`} className="block">
            <Card className="transition-colors hover:border-accent">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-text">
                    {client.first_name} {client.last_name}
                  </p>
                  {client.partner_name ? (
                    <p className="text-xs text-text-muted">& {client.partner_name}</p>
                  ) : null}
                  <p className="text-xs text-text-muted">{client.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <ClientStatusBadge status={client.internal_status} />
                  <VipBadge isVip={client.is_vip} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                {client.source ? <span>{client.source}</span> : null}
                {client.tags.length > 0 ? <span>{client.tags.join(", ")}</span> : null}
              </div>
              {nextAction ? (
                <p className="mt-2 text-xs font-medium text-accent">{nextAction}</p>
              ) : null}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
