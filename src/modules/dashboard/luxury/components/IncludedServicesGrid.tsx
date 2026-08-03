import { createElement } from "react";
import { resolveLuxuryIcon } from "@/modules/dashboard/luxury/resolveLuxuryIcon";
import { EmptyState } from "@/components/ui/EmptyState";

export interface IncludedServiceData {
  id: string;
  label: string;
  icon: string;
}

/** Checkpoint 19, Step 9 — the Client Dashboard's "What's Included" grid, sourced from the client's own Event's real assigned Services (`listEventServicesByEvent`) — never a fabricated static list. An Event with no Services assigned yet renders the honest empty state instead of an invented package. */
export function IncludedServicesGrid({ services }: { services: IncludedServiceData[] }) {
  if (services.length === 0) {
    return <EmptyState title="No services assigned yet" description="Once your planner assigns services to your event, they'll appear here." />;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {services.map((service) => {
        const iconElement = createElement(resolveLuxuryIcon(service.icon), { className: "h-4.5 w-4.5", "aria-hidden": true });
        return (
          <li key={service.id} className="flex flex-col items-center gap-2 rounded-luxury-md bg-luxury-surface-tint py-4 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-luxury-blush text-luxury-rose">{iconElement}</span>
            <span className="text-luxury-small font-medium text-luxury-text">{service.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
