import type { CarouselSlide } from "@/types/carouselSlide";

let carouselSlides: CarouselSlide[] = [];

export function readCarouselSlides(): CarouselSlide[] {
  return carouselSlides;
}

export function writeCarouselSlides(next: CarouselSlide[]): void {
  carouselSlides = next;
}

export function resetCarouselSlidesStore(): void {
  carouselSlides = [];
}
