/**
 * SOCIAL-08B — one ordered, plain-text content block within a
 * `ScriptVersion`. Scoped to `script_version_id` (never `script_id`
 * directly), mirroring the Services template family's own `display_order`
 * convention. No block "type" (scene/dialogue/voiceover/note) exists yet —
 * no established precedent to mirror and no editing UI in this
 * checkpoint's scope; see the migration's own comment.
 */

export interface ScriptBlock {
  id: string;
  script_version_id: string;
  workspace_id: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
