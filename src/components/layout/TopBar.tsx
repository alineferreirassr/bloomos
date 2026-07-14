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
    <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-5 md:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-text md:hidden"
        aria-label="Open navigation menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <p className="text-sm font-medium tracking-tight text-text-muted">
        {activeItem?.label ?? "BloomOS"}
      </p>
    </header>
  );
}
