/**
 * "mod" abstracts Cmd (macOS) vs Ctrl (Windows/Linux) so a `CommandAction`
 * declares one shortcut string, e.g. "mod+k", that means the right thing on
 * whichever platform actually opens the browser — never hardcode Cmd or
 * Ctrl in a shortcut definition.
 */
export interface ParsedShortcut {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  /** Always lowercase, e.g. "k", "escape". */
  key: string;
}

export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut
    .toLowerCase()
    .split("+")
    .map((part) => part.trim());

  return {
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key: parts.filter((part) => !["mod", "shift", "alt"].includes(part)).pop() ?? "",
  };
}

/** True if `event` matches `shortcut` exactly — no partial/extra modifiers. */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  const modPressed = event.metaKey || event.ctrlKey;

  return (
    modPressed === parsed.mod &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.key.toLowerCase() === parsed.key
  );
}
