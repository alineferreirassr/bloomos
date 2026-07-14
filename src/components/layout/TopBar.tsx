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
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text md:hidden"
        aria-label="Open navigation menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <h1 className="text-sm font-medium text-text">
        {activeItem?.label ?? "BloomOS"}
      </h1>
    </header>
  );
}
