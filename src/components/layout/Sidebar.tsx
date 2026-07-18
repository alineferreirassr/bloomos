"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVisibleNavigationGroups } from "@/config/navigation";
import { WorkspaceAvatar } from "@/components/layout/WorkspaceAvatar";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

interface SidebarProps {
  workspaceDisplayName: string;
}

export function Sidebar({ workspaceDisplayName }: SidebarProps) {
  const pathname = usePathname();
  const { can } = useMemberSession();
  const navigationGroups = getVisibleNavigationGroups(can);

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:bg-sidebar md:border-r md:border-border md:py-6">
      <div className="mb-4 border-b border-border px-[23px] pb-[23px]">
        <Image
          src="/brand/amore-bloom-logo.png"
          alt="Amoré Bloom"
          width={640}
          height={426}
          priority
          className="h-auto w-36"
        />
        <div className="mt-1 text-[11px] tracking-[0.06em] text-text/55 uppercase">
          Luxury Proposal &amp; Event Studio
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5">
        {navigationGroups.map((group) => (
          <div key={group.label ?? "__ungrouped"} className="flex flex-col gap-0.5">
            {group.label ? (
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-[0.06em] text-text/45 uppercase">
                {group.label}
              </div>
            ) : null}
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-[14.5px] transition-colors duration-150 ${
                    isActive
                      ? "border-accent bg-accent/7 font-semibold text-text"
                      : "border-transparent font-normal text-text hover:bg-accent/10"
                  }`}
                >
                  <Icon
                    className={`h-[17px] w-[17px] shrink-0 ${isActive ? "opacity-95" : "opacity-60"}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

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
