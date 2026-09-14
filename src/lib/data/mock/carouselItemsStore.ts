import type { CarouselItem } from "@/types/carouselItem";

let carouselItems: CarouselItem[] = [];

export function readCarouselItems(): CarouselItem[] {
  return carouselItems;
}

export function writeCarouselItems(next: CarouselItem[]): void {
  carouselItems = next;
}

export function resetCarouselItemsStore(): void {
  carouselItems = [];
}
