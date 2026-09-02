import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import type { Lead } from "@/types/lead";
import { LeadStatusBadge } from "@/modules/leads/components/LeadStatusBadge";

/* Relationships/CRM visual pass — reuses the same LuxuryCard surface the
   approved Founder/Team Home dashboards use, so the mobile card list reads
   as the same product family rather than a separate admin-table fallback. */
export function LeadListCards({ leads }: { leads: Lead[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {leads.map((lead) => (
        <Link key={lead.id} href={`/leads/${lead.id}`} className="block">
          <LuxuryCard className="transition-transform duration-150 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">
                  {lead.first_name} {lead.last_name}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{lead.email}</p>
              </div>
              <LeadStatusBadge status={lead.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>{lead.source}</span>
              {lead.event_type ? <span>{lead.event_type}</span> : null}
              {lead.event_date ? (
                <span>{new Date(lead.event_date).toLocaleDateString()}</span>
              ) : null}
            </div>
          </LuxuryCard>
        </Link>
      ))}
    </div>
  );
}
