"use client";

import { resolveSectionIcon } from "@/modules/settings/sectionIcons";
import type { SettingsSectionSummary } from "@/modules/settings/getSettingsPageData";

interface SettingsSectionNavProps {
  sections: SettingsSectionSummary[];
  activeSectionId: string;
  onSelect: (sectionId: string) => void;
}

/**
 * The Step 3 Section Registry, rendered — every entry comes from
 * `sections` (already sorted by `order`, already permission/role/flag
 * filtered server-side), never a hand-maintained list of section ids. A
 * 15th self-registered Section shows up here automatically.
 */
export function SettingsSectionNav({ sections, activeSectionId, onSelect }: SettingsSectionNavProps) {
  return (
    <nav aria-label="Settings sections" className="flex shrink-0 flex-col gap-0.5 sm:w-56">
      {sections.map((section) => {
        const Icon = resolveSectionIcon(section.icon);
        const active = section.id === activeSectionId;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={active ? "true" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-150 ${
              active ? "bg-accent-100 font-semibold text-accent-800" : "text-text/70 hover:bg-text/7 hover:text-text"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
