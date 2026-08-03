import {
  LayoutDashboard,
  Building2,
  Palette,
  Sparkles,
  Wand2,
  BrainCircuit,
  Zap,
  Workflow,
  Users,
  Banknote,
  Bell,
  ShieldCheck,
  Terminal,
  Info,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * `SettingsSectionDefinition.icon` is a plain string (never a React
 * component reference — see that field's own doc comment in
 * `types/settings.ts`), so the Section Registry stays importable from
 * server code. This is the one place that string is resolved to a real
 * icon, mirroring `modules/workflow/canvas/nodeIcons.ts`'s own
 * `resolveNodeIcon` exactly. `HelpCircle` is the fallback for a name not in
 * this map — should only happen for a future section whose own icon string
 * hasn't been added here yet, never for one of the 14 Step 3 built-ins.
 */
const SECTION_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Palette,
  Sparkles,
  Wand2,
  BrainCircuit,
  Zap,
  Workflow,
  Users,
  Banknote,
  Bell,
  ShieldCheck,
  Terminal,
  Info,
};

export function resolveSectionIcon(name: string): LucideIcon {
  return SECTION_ICONS[name] ?? HelpCircle;
}
