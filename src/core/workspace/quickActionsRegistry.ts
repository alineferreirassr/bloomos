import type { WorkspaceQuickAction } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 7 — Quick Actions. A static registry of
 * shortcuts into real, already-built creation flows — never new business
 * logic. Two entries (`new_proposal`, `upload_asset`) point at their
 * module's own dashboard rather than a `/new` route, because neither
 * Proposals nor Digital Assets has a standalone creation page — both
 * create inline (a button/modal on the dashboard itself), confirmed by
 * checking `src/app/(app)/proposals` and `src/app/(app)/assets` before
 * writing this list, so no entry links to a route that doesn't exist.
 */
export function listWorkspaceQuickActions(): WorkspaceQuickAction[] {
  return [
    { id: "new_lead", label: "New Lead", description: "Add a new inbound lead to the pipeline.", group: "CRM", href: "/leads/new", icon: "user-plus" },
    { id: "new_client", label: "New Client", description: "Create a new client record.", group: "CRM", href: "/clients/new", icon: "user" },
    { id: "new_event", label: "New Event", description: "Start planning a new event.", group: "Events", href: "/events/new", icon: "calendar-plus" },
    { id: "new_contract", label: "New Contract", description: "Draft a new contract.", group: "CRM", href: "/contracts/new", icon: "file-signature" },
    { id: "new_invoice", label: "New Invoice", description: "Create a new invoice.", group: "Finance", href: "/finance/invoices/new", icon: "receipt" },
    { id: "new_document", label: "New Document", description: "Compose a new document.", group: "Documents", href: "/documents/new", icon: "file-plus" },
    { id: "new_proposal", label: "New Proposal", description: "Build a new client proposal.", group: "CRM", href: "/proposals", icon: "file-text" },
    { id: "upload_asset", label: "Upload Asset", description: "Upload a file to the Digital Asset Library.", group: "Assets", href: "/assets", icon: "upload" },
    { id: "new_vendor", label: "New Vendor", description: "Add a new vendor.", group: "Vendors", href: "/vendors/new", icon: "briefcase" },
    { id: "new_purchase", label: "New Purchase", description: "Log a new purchase order.", group: "Purchases", href: "/purchases/new", icon: "shopping-cart" },
    // v2.0 Checkpoint 40 — Global Search & Universal Command Center. Same
    // "link to the dashboard itself, not a fake /new route" precedent as
    // `new_proposal`/`upload_asset` above — Dispatch, Route Optimization,
    // and Digital Assets folders are all created inline (a dialog on their
    // own dashboard), confirmed by checking `src/app/(app)/dispatch`,
    // `src/app/(app)/route-optimization`, and `src/app/(app)/assets` before
    // writing these three entries.
    { id: "new_dispatch", label: "New Dispatch Order", description: "Build a new dispatch order from an Execution Package.", group: "Operations", href: "/dispatch", icon: "truck" },
    { id: "new_route", label: "New Route Plan", description: "Build a new route plan for a dispatch assignment.", group: "Operations", href: "/route-optimization", icon: "map" },
    { id: "new_asset_folder", label: "New Asset Folder", description: "Organize the Digital Asset Library with a new folder.", group: "Assets", href: "/assets", icon: "folder-plus" },
  ];
}
