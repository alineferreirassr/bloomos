# Keyboard Shortcuts

v2.0 Checkpoint 40 — Global Search & Universal Command Center. Every keyboard interaction the checkpoint's "keyboard-first navigation" requirement covers, and where it's implemented.

## Global

| Shortcut | Action | Implemented in |
|---|---|---|
| `Cmd+K` / `Ctrl+K` | Open/close the Universal Command Center overlay | `CommandPalette.tsx`, via `useKeyboardShortcut("mod+k", ...)` — mounted once in `(app)/layout.tsx`, works from any route |
| `Esc` | Close the overlay | `useDialogBehavior()` (shared dialog hook every modal in this codebase already uses) |

`mod` means Cmd on macOS, Ctrl elsewhere — `useKeyboardShortcut`'s own established convention (`core/commandPalette/useKeyboardShortcut.ts`).

## Inside the Command Center overlay

| Key | Action |
|---|---|
| `↓` | Move the highlighted row to the next command/result |
| `↑` | Move the highlighted row to the previous command/result |
| `Enter` | Run the highlighted command, or navigate to the highlighted search result |
| Typing | Filters commands (`filterCommands()`) and searches (`searchAction()`, debounced by the query effect) simultaneously |

The highlighted index (`activeIndex`) is a single roving cursor across the *merged* commands-then-results list — pressing `↓` past the last command moves into the first search result, matching how a single flat list reads visually.

## Standard browser/OS keyboard behavior (unchanged, not reimplemented)

Every input, button, and link across the new Search & Command Center surfaces (`/search`, `/search/results`, `/search/analytics`, `/command-center`) is a real, native, focusable HTML element — `Tab`/`Shift+Tab` cycles focus in document order, `Enter`/`Space` activates a focused button, and screen readers announce every control the same way they already do across the rest of BloomOS. Nothing here needed a custom `tabindex` or `role` beyond what the shared `ui/*` primitives (`Card`, `Badge`, `Button`, `PageHeader`) already provide.
