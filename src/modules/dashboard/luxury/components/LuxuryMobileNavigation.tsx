"use client";

import { useRef, type ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getVisibleNavigationModules } from "@/config/navigation";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { useDialogBehavior } from "@/components/ui/useDialogBehavior";
import { CloseIcon } from "@/components/ui/icons";
import { LuxuryNavigationList } from "@/modules/dashboard/luxury/components/LuxuryNavigationList";

interface LuxuryMobileNavigationProps {
  open: boolean;
  onClose: () => void;
  logoUrl: string | null;
  brandName: string;
  tagline: string;
  footer: ReactNode;
}

/** Checkpoint 19, Step 11/12 — the Luxury Dashboard's mobile drawer: same focus-trap/Escape-to-close/scroll-lock behavior `Modal`/`Drawer` already share via `useDialogBehavior`, same real navigation data as `LuxurySidebar`. */
export function LuxuryMobileNavigation({ open, onClose, logoUrl, brandName, tagline, footer }: LuxuryMobileNavigationProps) {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const navigationModules = getVisibleNavigationModules(can);
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open, onClose, containerRef });

  return (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className={`absolute inset-0 bg-luxury-text/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
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
            {logoUrl ? (
              <Image src={logoUrl} alt={brandName} width={640} height={426} className="h-auto w-32" />
            ) : (
              <p className="font-luxury-display text-xl font-semibold text-luxury-text">{brandName}</p>
            )}
            <p className="mt-1 text-[11px] tracking-[0.06em] text-luxury-text-muted uppercase">{tagline}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-luxury-text-muted transition-colors duration-150 hover:bg-luxury-blush hover:text-luxury-text"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <LuxuryNavigationList modules={navigationModules} pathname={pathname} onNavigate={onClose} />
        <div className="mt-4 px-4">{footer}</div>
      </div>
    </div>
  );
}
