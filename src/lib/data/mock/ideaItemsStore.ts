import type { IdeaItem } from "@/types/ideaItem";

let ideaItems: IdeaItem[] = [];

export function readIdeaItems(): IdeaItem[] {
  return ideaItems;
}

export function writeIdeaItems(next: IdeaItem[]): void {
  ideaItems = next;
}

export function resetIdeaItemsStore(): void {
  ideaItems = [];
}
