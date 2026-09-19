"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupVisibleNavigationModules } from "@/config/navigation";
import { NavigationTree } from "@/components/layout/NavigationTree";
import { CloseIcon } from "@/components/ui/icons";
import { WorkspaceAvatar } from "@/components/layout/WorkspaceAvatar";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  workspaceDisplayName: string;
}

/**
 * GLOBAL-VISUAL-01 Round 4.5 — same grouped/compact navigation as the
 * desktop Sidebar (see its own doc comment); the drawer must not diverge
 * into the old flat list either.
 *
 * GLOBAL-VISUAL-03B — branding header compacted to match the desktop
 * Sidebar's own GLOBAL-VISUAL-03B update (monogram badge + small logo +
 * tagline), so the mobile shell doesn't diverge from desktop the way it
 * did before.
 */
export function MobileNav({ open, onClose, workspaceDisplayName }: MobileNavProps) {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const groups = groupVisibleNavigationModules(can);

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`}
      inert={!open}
    >
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className={`absolute inset-0 bg-neutral-800/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar py-6 shadow-md transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-3 flex items-center justify-between border-b border-border/50 px-5 pb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
              AB
            </span>
            <div className="min-w-0">
              <Image
                src="/brand/amore-bloom-app-logo.png"
                alt="Amoré Bloom"
                width={670}
                height={670}
                className="h-auto max-h-6 w-auto"
              />
              <p className="mt-1 text-[10px] tracking-[0.06em] text-text/55 uppercase">
                Luxury Proposal &amp; Event Studio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <NavigationTree groups={groups} pathname={pathname} onNavigate={onClose} />
        <Link
          href="/account"
          onClick={onClose}
          className="mt-3 flex items-center gap-2.5 border-t border-border/50 px-[23px] pt-4 transition-colors duration-150 hover:bg-accent/7"
        >
          <WorkspaceAvatar />
          <div className="leading-tight">
            <div className="text-[13px] text-text">{workspaceDisplayName}</div>
            <div className="text-[11.5px] text-text/55">Amoré Bloom</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
