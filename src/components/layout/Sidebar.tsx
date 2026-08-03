"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVisibleNavigationModules } from "@/config/navigation";
import { NavigationTree } from "@/components/layout/NavigationTree";
import { WorkspaceAvatar } from "@/components/layout/WorkspaceAvatar";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface SidebarProps {
  workspaceDisplayName: string;
}

export function Sidebar({ workspaceDisplayName }: SidebarProps) {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const navigationModules = getVisibleNavigationModules(can);

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:bg-sidebar md:border-r md:border-border md:py-6">
      <div className="mb-4 border-b border-border px-[23px] pb-[23px]">
        <Image
          src="/brand/amore-bloom-app-logo.png"
          alt="Amoré Bloom"
          width={670}
          height={670}
          priority
          className="h-auto w-24"
        />
        <div className="mt-1 text-[11px] tracking-[0.06em] text-text/55 uppercase">
          Luxury Proposal &amp; Event Studio
        </div>
      </div>

      <NavigationTree modules={navigationModules} pathname={pathname} />

      <Link
        href="/account"
        className="mt-3 flex items-center gap-2.5 border-t border-border px-[23px] pt-4 transition-colors duration-150 hover:bg-accent/7"
      >
        <WorkspaceAvatar />
        <div className="leading-tight">
          <div className="text-[13px] text-text">{workspaceDisplayName}</div>
          <div className="text-[11.5px] text-text/55">Amoré Bloom</div>
        </div>
      </Link>
    </aside>
  );
}
