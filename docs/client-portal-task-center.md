# Task Center

`ClientPortalChecklistView.tsx`, at `/client-access/checklist`. The client-facing view of the real `checklist_items` table (Checkpoint 14, Step 7 originally) — never a second task model.

## Visibility gate

Only items a staff member has explicitly marked `client_visible: true` ever appear. A client may **Complete** or **Comment** — never edit an item's own title or description. "Upload attachment" remains an inert, explicitly-disabled placeholder.

## This checkpoint's own gap, closed: setting `client_visible` from the internal UI

Before Checkpoint 36, no internal UI ever exposed the `client_visible` flag — it existed in the schema and the client-facing read path, but staff had no way to actually toggle it. `ChecklistItemForm.tsx` (internal, `modules/events/components/`) now renders a "Show in client's Task Center" checkbox, gated by the new `client_portal.manage` permission (`useMemberSession().can("client_portal.manage")`) — a staff member without that permission never sees the control, and the field silently defaults to `false` for anyone who can't grant portal visibility.

The gate required threading `client_visible` through the full stack that was previously silently dropping it on read: `database.types.ts`'s `checklist_items` Row/Insert/Update types (stale relative to the real migration `20260718100100_checklist_items.sql`), and `mapChecklistItemRow` in `lib/supabase/mappers.ts` (which read every other column but this one).

## Named permission

| Permission | Gates |
|---|---|
| `client_portal.manage` | Toggling a Checklist item's `client_visible` flag from `ChecklistItemForm.tsx` |
| `client_portal.view` | Viewing a client's own Portal Activity log (see [`unified-client-portal.md`](unified-client-portal.md)) |
