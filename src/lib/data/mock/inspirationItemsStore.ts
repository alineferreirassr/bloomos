import type { InspirationItem } from "@/types/inspirationItem";

let inspirationItems: InspirationItem[] = [];

export function readInspirationItems(): InspirationItem[] {
  return inspirationItems;
}

export function writeInspirationItems(next: InspirationItem[]): void {
  inspirationItems = next;
}

export function resetInspirationItemsStore(): void {
  inspirationItems = [];
}
