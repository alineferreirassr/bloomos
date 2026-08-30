"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LuxuryNavRows } from "@/modules/dashboard/luxury/components/LuxuryNavRows";
import { CLIENT_NAV_ENTRIES } from "@/modules/dashboard/luxury/clientNavEntries";

interface LuxuryClientSidebarProps {
  logoUrl: string | null;
  brandName: string;
  footer: ReactNode;
}

/** Checkpoint 19, Step 9/11 — the Client Dashboard's own desktop sidebar, mirroring `LuxurySidebar`'s shape exactly but with the Client Portal's own real, permission-free nav list (`CLIENT_NAV_ENTRIES`) — a Client Account has no internal role/permission concept to filter by. */
export function LuxuryClientSidebar({ logoUrl, brandName, footer }: LuxuryClientSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-luxury-border md:bg-luxury-sidebar md:py-6">
      <div className="mb-4 px-6 pb-5">
        {logoUrl ? (
          <Image src={logoUrl} alt={brandName} width={640} height={640} priority className="h-auto w-36" />
        ) : (
          <p className="font-luxury-display text-2xl font-semibold text-luxury-text">{brandName}</p>
        )}
        <p className="mt-1 text-[11px] tracking-[0.06em] text-luxury-text-muted uppercase">Client Portal</p>
      </div>

      <LuxuryNavRows entries={CLIENT_NAV_ENTRIES} pathname={pathname} />

      <div className="mt-4 px-4">{footer}</div>
    </aside>
  );
}
