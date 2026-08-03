"use client";

import { useRef } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useDialogBehavior } from "@/components/ui/useDialogBehavior";
import { CloseIcon } from "@/components/ui/icons";
import { LuxuryNavRows } from "@/modules/dashboard/luxury/components/LuxuryNavRows";
import { CLIENT_NAV_ENTRIES } from "@/modules/dashboard/luxury/clientNavEntries";
import type { ReactNode } from "react";

interface LuxuryClientMobileNavigationProps {
  open: boolean;
  onClose: () => void;
  logoUrl: string | null;
  brandName: string;
  footer: ReactNode;
}

/** Checkpoint 19, Step 9/11/12 — the Client Dashboard's mobile drawer, mirroring `LuxuryMobileNavigation`'s exact focus-trap/Escape/scroll-lock behavior with the Client Portal's own nav list. */
export function LuxuryClientMobileNavigation({ open, onClose, logoUrl, brandName, footer }: LuxuryClientMobileNavigationProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open, onClose, containerRef });

  return (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <button type="button" aria-label="Close navigation menu" onClick={onClose} className={`absolute inset-0 bg-luxury-text/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        tabIndex={-1}
        className={`absolute inset-y-0 left-0 flex w-72 flex-col bg-luxury-sidebar py-6 shadow-luxury-lg transition-transform duration-[var(--luxury-duration-gentle-ms)] focus:outline-none ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-4 flex items-center justify-between px-6 pb-5">
          <div>
            {logoUrl ? <Image src={logoUrl} alt={brandName} width={640} height={426} className="h-auto w-32" /> : <p className="font-luxury-display text-xl font-semibold text-luxury-text">{brandName}</p>}
            <p className="mt-1 text-[11px] tracking-[0.06em] text-luxury-text-muted uppercase">Client Portal</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close navigation menu" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-luxury-text-muted transition-colors duration-150 hover:bg-luxury-blush hover:text-luxury-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <LuxuryNavRows entries={CLIENT_NAV_ENTRIES} pathname={pathname} onNavigate={onClose} />
        <div className="mt-4 px-4">{footer}</div>
      </div>
    </div>
  );
}
