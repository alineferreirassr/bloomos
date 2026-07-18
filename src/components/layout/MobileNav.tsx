"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVisibleNavigationGroups } from "@/config/navigation";
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
  const navigationGroups = getVisibleNavigationGroups(can);

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
                    onClick={onClose}
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
