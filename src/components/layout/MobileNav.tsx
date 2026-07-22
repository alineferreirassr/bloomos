"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVisibleNavigationModules } from "@/config/navigation";
import { NavigationTree } from "@/components/layout/NavigationTree";
import { CloseIcon } from "@/components/ui/icons";
import { WorkspaceAvatar } from "@/components/layout/WorkspaceAvatar";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  workspaceDisplayName: string;
}

export function MobileNav({ open, onClose, workspaceDisplayName }: MobileNavProps) {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const navigationModules = getVisibleNavigationModules(can);

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
        <div className="mb-4 flex items-center justify-between border-b border-border px-[23px] pb-[23px]">
          <div>
            <Image
              src="/brand/amore-bloom-logo.png"
              alt="Amoré Bloom"
              width={640}
              height={426}
              className="h-auto w-36"
            />
            <div className="mt-1 text-[11px] tracking-[0.06em] text-text/55 uppercase">
              Luxury Proposal &amp; Event Studio
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
        <NavigationTree modules={navigationModules} pathname={pathname} onNavigate={onClose} />
        <Link
          href="/account"
          onClick={onClose}
          className="mt-3 flex items-center gap-2.5 border-t border-border px-[23px] pt-4 transition-colors duration-150 hover:bg-accent/7"
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
