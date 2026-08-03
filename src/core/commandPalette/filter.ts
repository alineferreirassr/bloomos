import type { CommandAction } from "@/core/commandPalette/types";

/**
 * Case-insensitive substring match against `label` and `keywords` — the
 * same "good enough without an index" approach `nullSearchProvider`
 * documents for entity search; a command list is small enough that no
 * ranking pipeline is needed here, just a stable filter.
 */
export function filterCommands(commands: CommandAction[], query: string): CommandAction[] {
  const term = query.trim().toLowerCase();
  if (term === "") return commands;

  return commands.filter((command) => {
    if (command.label.toLowerCase().includes(term)) return true;
    return (command.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(term));
  });
}
