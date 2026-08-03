import { describe, expect, it, beforeEach, vi } from "vitest";
import { registerCommand, unregisterCommand, getCommands, getCommandById, resetCommandRegistry } from "@/core/commandPalette/registry";
import { filterCommands } from "@/core/commandPalette/filter";
import { parseShortcut, matchesShortcut } from "@/core/commandPalette/shortcuts";
import type { CommandAction } from "@/core/commandPalette/types";

function makeCommand(overrides: Partial<CommandAction> = {}): CommandAction {
  return { id: "test-command", label: "Test Command", group: "Test", run: vi.fn(), ...overrides };
}

describe("command registry", () => {
  beforeEach(() => {
    resetCommandRegistry();
  });

  it("registers a command and makes it retrievable", () => {
    registerCommand(makeCommand());
    expect(getCommandById("test-command")?.label).toBe("Test Command");
    expect(getCommands()).toHaveLength(1);
  });

  it("unregisters a command", () => {
    registerCommand(makeCommand());
    unregisterCommand("test-command");
    expect(getCommandById("test-command")).toBeUndefined();
    expect(getCommands()).toHaveLength(0);
  });

  it("starts empty — no business commands registered by default", () => {
    expect(getCommands()).toEqual([]);
  });
});

describe("filterCommands", () => {
  const commands: CommandAction[] = [
    makeCommand({ id: "new-lead", label: "New Lead", keywords: ["create", "add"] }),
    makeCommand({ id: "new-event", label: "New Event", keywords: ["create", "schedule"] }),
    makeCommand({ id: "settings", label: "Settings" }),
  ];

  it("returns everything for an empty query", () => {
    expect(filterCommands(commands, "")).toHaveLength(3);
  });

  it("matches on label, case-insensitively", () => {
    expect(filterCommands(commands, "lead").map((c) => c.id)).toEqual(["new-lead"]);
    expect(filterCommands(commands, "LEAD").map((c) => c.id)).toEqual(["new-lead"]);
  });

  it("matches on a keyword the label doesn't contain", () => {
    const results = filterCommands(commands, "create").map((c) => c.id);
    expect(results).toEqual(["new-lead", "new-event"]);
  });

  it("returns nothing for a non-matching query", () => {
    expect(filterCommands(commands, "xyz")).toEqual([]);
  });
});

describe("parseShortcut", () => {
  it("parses a simple mod+key combo", () => {
    expect(parseShortcut("mod+k")).toEqual({ mod: true, shift: false, alt: false, key: "k" });
  });

  it("parses shift and alt modifiers", () => {
    expect(parseShortcut("mod+shift+p")).toEqual({ mod: true, shift: true, alt: false, key: "p" });
  });

  it("parses a bare key with no modifiers", () => {
    expect(parseShortcut("escape")).toEqual({ mod: false, shift: false, alt: false, key: "escape" });
  });
});

describe("matchesShortcut", () => {
  function makeEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
    return { key: "k", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init } as KeyboardEvent;
  }

  it("matches Cmd+K on macOS (metaKey)", () => {
    expect(matchesShortcut(makeEvent({ key: "k", metaKey: true }), "mod+k")).toBe(true);
  });

  it("matches Ctrl+K on Windows/Linux (ctrlKey)", () => {
    expect(matchesShortcut(makeEvent({ key: "k", ctrlKey: true }), "mod+k")).toBe(true);
  });

  it("does not match when an extra modifier is held", () => {
    expect(matchesShortcut(makeEvent({ key: "k", metaKey: true, shiftKey: true }), "mod+k")).toBe(false);
  });

  it("does not match a different key", () => {
    expect(matchesShortcut(makeEvent({ key: "j", metaKey: true }), "mod+k")).toBe(false);
  });

  it("does not match with no modifier when mod is required", () => {
    expect(matchesShortcut(makeEvent({ key: "k" }), "mod+k")).toBe(false);
  });
});
