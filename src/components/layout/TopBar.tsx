"use client";

import { usePathname } from "next/navigation";
import { navigationItems } from "@/config/navigation";
import { MenuIcon } from "@/components/ui/icons";

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const activeItem = navigationItems.find((item) =>
    pathname.startsWith(item.href),
  );

  return (
    <header className="flex h-[72px] min-h-[72px] items-center gap-3 border-b border-border bg-background px-4 md:px-7">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text md:hidden"
        aria-label="Open navigation menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      {/*
        The approved Header mockup puts the 24px serif page title here, with
        no separate title inside the page body. This app's page bodies (e.g.
        ClientsListView, DashboardPage) already render their own large serif
        h2 title just below — duplicating it here would show the same title
        twice stacked on screen. Kept small/muted instead, functioning as a
        breadcrumb, so the one large title stays where it already lives.
      */}
      <p className="text-sm font-medium tracking-tight text-text-muted">
        {activeItem?.label ?? "BloomOS"}
      </p>
    </header>
  );
}
