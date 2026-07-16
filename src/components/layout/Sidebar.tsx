"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/config/navigation";
import { CURRENT_ACTOR } from "@/core/constants/actor";

export function Sidebar() {
  const pathname = usePathname();

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

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3.5">
        {navigationItems.map((item) => {
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
      </nav>

      <div className="mt-3 flex items-center gap-2.5 border-t border-border px-[23px] pt-4">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-border font-serif text-[13px] text-text">
          AB
        </div>
        <div className="leading-tight">
          <div className="text-[13px] text-text">{CURRENT_ACTOR}</div>
          <div className="text-[11.5px] text-text/55">Amoré Bloom</div>
        </div>
      </div>
    </aside>
  );
}
