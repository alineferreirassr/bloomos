/**
 * App Shell redesign — `CommandPalette.tsx` owns its `open` state locally
 * and previously only ever set it via its own "mod+k" listener, with no
 * external trigger. The new Luxury Topbar's search pill needs to open the
 * same singleton palette on click, without duplicating its search/command
 * logic into a second component. A `window` custom event is the smallest
 * possible additive bridge: `CommandPalette` adds one more listener
 * alongside its existing keyboard shortcut (nothing removed), and any
 * client component anywhere in the tree can call `dispatchOpenCommandPalette()`
 * without needing a shared context provider.
 */
export const COMMAND_PALETTE_OPEN_EVENT = "bloomos:open-command-palette";

export function dispatchOpenCommandPalette(): void {
  window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
}
