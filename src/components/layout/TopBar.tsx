"use client";

import { usePathname } from "next/navigation";
import { findActiveNavLabel } from "@/config/navigation";
import { MenuIcon, BloomAiIcon } from "@/components/ui/icons";
import { useCopilotPanel } from "@/modules/ai/copilot/CopilotProvider";

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const activeLabel = findActiveNavLabel(pathname);
  const { toggle } = useCopilotPanel();

  return (
    <header className="flex h-[72px] min-h-[72px] items-center gap-3 bg-background px-4 shadow-sm md:px-7">
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
      <p className="flex-1 text-sm font-medium tracking-tight text-text-muted">
        {activeLabel ?? "Amoré Bloom"}
      </p>
      <button
        type="button"
        onClick={toggle}
        className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors duration-150 hover:bg-accent-100 hover:text-accent md:flex"
      >
        <BloomAiIcon className="h-4 w-4" aria-hidden="true" />
        Bloom AI
      </button>
    </header>
  );
}
