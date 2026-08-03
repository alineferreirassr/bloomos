/**
 * `WorkflowNodeDefinition.color` names a design token (`"neutral"`,
 * `"accent"`, `"warning"`, `"success"`, `"danger"`) — never a raw hex, so
 * both themes stay consistent automatically (see that field's own doc
 * comment). This is the one place those names resolve to real Tailwind
 * classes, reusing the exact token pairs `Badge.tsx` already established
 * for the same tones, so a node's own category color always matches how
 * that same concept reads everywhere else in BloomOS.
 */
const NODE_COLOR_CLASSES: Record<string, { chip: string; border: string }> = {
  neutral: { chip: "bg-neutral-100 text-neutral-800", border: "border-neutral-800/25" },
  accent: { chip: "bg-accent-100 text-accent-800", border: "border-accent/40" },
  warning: { chip: "bg-accent-100 text-accent-2", border: "border-accent-2/40" },
  success: { chip: "bg-accent-100 text-accent-800", border: "border-accent/40" },
  danger: { chip: "bg-accent-100 text-danger", border: "border-danger/40" },
};

export function resolveNodeColorClasses(color: string): { chip: string; border: string } {
  return NODE_COLOR_CLASSES[color] ?? NODE_COLOR_CLASSES.neutral;
}
