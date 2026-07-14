export interface DashboardMetric {
  label: string;
  value: string;
  href: string;
}

export function getDashboardMetrics(): DashboardMetric[] {
  return [
    { label: "Leads", value: "—", href: "/leads" },
    { label: "Clients", value: "—", href: "/clients" },
    { label: "Events", value: "—", href: "/events" },
    { label: "Contracts", value: "—", href: "/contracts" },
    { label: "Finance", value: "—", href: "/finance" },
  ];
}
