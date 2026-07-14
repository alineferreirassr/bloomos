import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Lead } from "@/types/lead";
import { LeadStatusBadge } from "@/modules/leads/components/LeadStatusBadge";

export function LeadListCards({ leads }: { leads: Lead[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {leads.map((lead) => (
        <Link key={lead.id} href={`/leads/${lead.id}`} className="block">
          <Card className="transition-colors hover:border-accent">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-text">
                  {lead.first_name} {lead.last_name}
                </p>
                <p className="text-xs text-text-muted">{lead.email}</p>
              </div>
              <LeadStatusBadge status={lead.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>{lead.source}</span>
              {lead.event_type ? <span>{lead.event_type}</span> : null}
              {lead.event_date ? (
                <span>{new Date(lead.event_date).toLocaleDateString()}</span>
              ) : null}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
