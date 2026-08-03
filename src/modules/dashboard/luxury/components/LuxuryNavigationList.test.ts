import { describe, expect, it } from "vitest";
import { flattenForLuxurySidebar } from "@/modules/dashboard/luxury/components/LuxuryNavigationList";
import type { NavModule } from "@/config/navigation";
import { DashboardIcon, CrmIcon } from "@/components/ui/icons";

describe("flattenForLuxurySidebar", () => {
  it("keeps a direct-link module as-is", () => {
    const modules: NavModule[] = [{ id: "dashboard", label: "Dashboard", icon: DashboardIcon, href: "/dashboard" }];
    expect(flattenForLuxurySidebar(modules)).toEqual([{ id: "dashboard", label: "Dashboard", icon: DashboardIcon, href: "/dashboard" }]);
  });

  it("collapses an expandable group to its first child's href", () => {
    const modules: NavModule[] = [
      { id: "crm", label: "CRM", icon: CrmIcon, children: [{ id: "leads", label: "Leads", href: "/leads" }, { id: "clients", label: "Clients", href: "/clients" }] },
    ];
    expect(flattenForLuxurySidebar(modules)).toEqual([{ id: "crm", label: "CRM", icon: CrmIcon, href: "/leads" }]);
  });

  it("drops a disabled module entirely", () => {
    const modules: NavModule[] = [{ id: "soon", label: "Soon", icon: DashboardIcon, href: "/soon", disabled: true }];
    expect(flattenForLuxurySidebar(modules)).toHaveLength(0);
  });

  it("drops a group with no children and no href", () => {
    const modules: NavModule[] = [{ id: "empty", label: "Empty", icon: DashboardIcon }];
    expect(flattenForLuxurySidebar(modules)).toHaveLength(0);
  });
});
