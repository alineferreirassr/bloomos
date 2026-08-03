# Prompt Library (v2 Checkpoint 20)

A categorized set of starting points for the Writing Studio, reachable from the Copilot panel footer or directly at `/bloom-ai/prompts`.

## Structure

`modules/ai/copilot/promptLibrary/prompts.ts`:

```ts
const PROMPT_CATEGORIES = [
  "CRM", "Finance", "Events", "Inventory", "Documents", "Marketing", "Client Care", "Operations",
] as const;

interface PromptTemplate {
  id: string;
  category: (typeof PROMPT_CATEGORIES)[number];
  title: string;
  prompt: string;
}

const PROMPT_LIBRARY: PromptTemplate[] = [ /* 2 templates per category, 16 total */ ];
```

Two hand-written templates per category, covering the checkpoint's own required scope: CRM (Follow-up message, VIP client check-in), Finance (Invoice reminder, Payment plan offer), Events (Day-of timeline, Vendor brief), Inventory (Restock note, Purchase request), Documents (Cover note, Document summary), Marketing (Social caption, Newsletter blurb), Client Care (Welcome message, Thank-you note), Operations (Team update, Handoff note).

## UI

`PromptLibraryView.tsx` (`/bloom-ai/prompts`) renders every category as a section, each prompt as a card with:

- The prompt's title and full text.
- A star toggle to save/unsave it as a favorite (☆ / ★).
- An "Open in Writing Studio" link, which opens the Writing Studio pre-filled with this prompt as the starting text (`initialText`), letting a member immediately run Rewrite/Shorten/Luxury Tone/etc. against it.

## Favorites, via the existing Memory Manager

Saving a favorite does **not** introduce a new persistence layer. `copilotPreferences.ts`'s `toggleFavoritePrompt(workspaceId, memberId, promptId)` / `listFavoritePromptIds(workspaceId, memberId)` call the same `getMemoryManager()` API the Memory Layer (Checkpoint 6) already exposes, tagged `favorite-prompt`, scoped `visibility: "user"`, `category: "workspace_knowledge"`, `source: "human"`, `approvalStatus: "approved"` — a human explicitly starring a prompt is, by definition, an approved piece of workspace knowledge about how that person likes to work.

## Why static, not generated

Per this checkpoint's stop condition (no external AI provider yet), the Prompt Library is a fixed, hand-curated set rather than AI-generated suggestions — every prompt here is text a real person wrote to be immediately useful, not a placeholder for a future generation step. Extending it is additive: append a new `PromptTemplate` to `PROMPT_LIBRARY`, no schema or UI change required.

## See also

- [Writing Engine](writing-engine.md) — what actually runs when a prompt is opened in the Writing Studio.
- [Bloom AI Copilot architecture](bloom-ai-architecture.md)
