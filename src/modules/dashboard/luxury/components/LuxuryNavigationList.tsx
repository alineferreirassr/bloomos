import type { NavModule } from "@/config/navigation";
import { LuxuryNavRows, type LuxuryNavEntry } from "@/modules/dashboard/luxury/components/LuxuryNavRows";

/** A module's own effective link — its direct `href` if it has one, otherwise its first visible child's `href` (an expandable group like "CRM" collapses to one flat row here). `null` for a disabled module with no reachable destination. */
function effectiveHref(navModule: NavModule): string | null {
  return navModule.href ?? navModule.children?.[0]?.href ?? null;
}

/**
 * Checkpoint 19, Step 11 — flattens the real, permission-filtered
 * `navigationModules` tree (`config/navigation.ts`) into the single-level
 * list the three approved reference images show (no expand/collapse
 * arrows in any of them). Never a hand-typed duplicate nav list — every
 * entry still traces back to the one real navigation data source, just
 * rendered without nesting. A destination the reference images name but
 * that has no real route yet (Calendar, Tasks, Gallery, Reports as their
 * own top-level pages) is never invented here — see
 * docs/luxury-design-system.md's Known limitations.
 */
export function flattenForLuxurySidebar(modules: NavModule[]): LuxuryNavEntry[] {
  return modules
    .map((navModule) => {
      const href = effectiveHref(navModule);
      if (!href || navModule.disabled) return null;
      return { id: navModule.id, label: navModule.label, href, icon: navModule.icon };
    })
    .filter((entry): entry is LuxuryNavEntry => entry !== null);
}

interface LuxuryNavigationListProps {
  modules: NavModule[];
  pathname: string;
  onNavigate?: () => void;
}

/** The internal-Sidebar-flavored nav list — flattens `navigationModules` then delegates rendering to the shared `LuxuryNavRows`. */
export function LuxuryNavigationList({ modules, pathname, onNavigate }: LuxuryNavigationListProps) {
  return <LuxuryNavRows entries={flattenForLuxurySidebar(modules)} pathname={pathname} onNavigate={onNavigate} />;
}
