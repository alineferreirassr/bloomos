"use client";

import type { ReactNode } from "react";

interface IconBadgeButtonProps {
  icon: ReactNode;
  count: number;
  label: string;
  onClick?: () => void;
}

/** The shared "circular icon button with an unread-count badge" shape behind both NotificationButton and MessageButton — one component, two thin call sites, never two near-duplicate implementations. */
export function IconBadgeButton({ icon, count, label, onClick }: IconBadgeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `${count} ${label}` : label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-luxury-text transition-colors duration-150 hover:bg-luxury-blush focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]"
    >
      {icon}
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-luxury-rose px-1 text-[10px] font-semibold text-luxury-rose-foreground">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}
