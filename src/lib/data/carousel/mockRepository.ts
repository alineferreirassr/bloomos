import type { CarouselItem } from "@/types/carouselItem";
import type { CarouselSlide } from "@/types/carouselSlide";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readCarouselItems, writeCarouselItems } from "@/lib/data/mock/carouselItemsStore";
import { readCarouselSlides, writeCarouselSlides } from "@/lib/data/mock/carouselSlidesStore";
import type {
  CarouselRepository,
  CreateCarouselItemInput,
  UpdateCarouselItemInput,
  ListCarouselItemsFilters,
  CreateCarouselSlideInput,
  UpdateCarouselSlideInput,
} from "@/lib/data/carousel/repository";

const CAROUSEL_NOT_FOUND_ERROR = "This Carousel could not be found.";
const CAROUSEL_SLIDE_NOT_FOUND_ERROR = "This Carousel slide could not be found.";

async function createCarouselItem(input: CreateCarouselItemInput): Promise<DataResult<CarouselItem>> {
  const items = readCarouselItems();

  const timestamp = nowIso();
  const item: CarouselItem = {
    id: generateId("carousel_item"),
    workspace_id: input.workspaceId,
    title: input.title,
    status: "active",
    source_idea_id: input.sourceIdeaId,
    archived_at: null,
    created_by: input.createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeCarouselItems([...items, item]);
  return ok(item);
}

async function getCarouselItemById(id: string): Promise<CarouselItem> {
  const item = readCarouselItems().find((i) => i.id === id);
  if (!item) throw new Error(CAROUSEL_NOT_FOUND_ERROR);
  return item;
}

async function listCarouselItems(workspaceId: string, filters: ListCarouselItemsFilters = {}): Promise<CarouselItem[]> {
  const { archived = "active", search, limit = 50, offset = 0 } = filters;
  const trimmedSearch = search?.trim().toLowerCase();

  const filtered = readCarouselItems().filter((item) => {
    if (item.workspace_id !== workspaceId) return false;
    if (archived === "active" && item.status !== "active") return false;
    if (archived === "archived" && item.status !== "archived") return false;
    if (trimmedSearch && !item.title.toLowerCase().includes(trimmedSearch)) return false;
    return true;
  });

  return filtered
    .sort((a, b) => {
      const byCreatedAt = b.created_at.localeCompare(a.created_at);
      return byCreatedAt !== 0 ? byCreatedAt : b.id.localeCompare(a.id);
    })
    .slice(offset, offset + limit);
}

async function updateCarouselItem(id: string, input: UpdateCarouselItemInput): Promise<DataResult<CarouselItem>> {
  const items = readCarouselItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(CAROUSEL_NOT_FOUND_ERROR);

  const updated: CarouselItem = {
    ...existing,
    title: input.title ?? existing.title,
    source_idea_id: input.sourceIdeaId !== undefined ? input.sourceIdeaId : existing.source_idea_id,
    updated_at: nowIso(),
  };

  writeCarouselItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function archiveCarouselItem(id: string): Promise<DataResult<CarouselItem>> {
  const items = readCarouselItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(CAROUSEL_NOT_FOUND_ERROR);
  if (existing.status === "archived") return ok(existing);

  const updated: CarouselItem = { ...existing, status: "archived", archived_at: nowIso(), updated_at: nowIso() };
  writeCarouselItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function unarchiveCarouselItem(id: string): Promise<DataResult<CarouselItem>> {
  const items = readCarouselItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(CAROUSEL_NOT_FOUND_ERROR);
  if (existing.status === "active") return ok(existing);

  const updated: CarouselItem = { ...existing, status: "active", archived_at: null, updated_at: nowIso() };
  writeCarouselItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function createCarouselSlide(input: CreateCarouselSlideInput): Promise<DataResult<CarouselSlide>> {
  const slides = readCarouselSlides();

  const timestamp = nowIso();
  const slide: CarouselSlide = {
    id: generateId("carousel_slide"),
    carousel_id: input.carouselId,
    workspace_id: input.workspaceId,
    content: input.content,
    sort_order: input.sortOrder,
    media_asset_id: input.mediaAssetId,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeCarouselSlides([...slides, slide]);
  return ok(slide);
}

async function listCarouselSlides(carouselId: string): Promise<CarouselSlide[]> {
  return readCarouselSlides()
    .filter((s) => s.carousel_id === carouselId)
    .sort((a, b) => {
      const byOrder = a.sort_order - b.sort_order;
      return byOrder !== 0 ? byOrder : a.id.localeCompare(b.id);
    });
}

async function updateCarouselSlide(id: string, input: UpdateCarouselSlideInput): Promise<DataResult<CarouselSlide>> {
  const slides = readCarouselSlides();
  const existing = slides.find((s) => s.id === id);
  if (!existing) return fail(CAROUSEL_SLIDE_NOT_FOUND_ERROR);

  const updated: CarouselSlide = {
    ...existing,
    content: input.content ?? existing.content,
    sort_order: input.sortOrder ?? existing.sort_order,
    media_asset_id: input.mediaAssetId !== undefined ? input.mediaAssetId : existing.media_asset_id,
    updated_at: nowIso(),
  };

  writeCarouselSlides(slides.map((s) => (s.id === id ? updated : s)));
  return ok(updated);
}

async function removeCarouselSlide(id: string): Promise<DataResult<null>> {
  const slides = readCarouselSlides();
  const existing = slides.find((s) => s.id === id);
  if (!existing) return fail(CAROUSEL_SLIDE_NOT_FOUND_ERROR);

  writeCarouselSlides(slides.filter((s) => s.id !== id));
  return ok(null);
}

export const mockCarouselRepository: CarouselRepository = {
  createCarouselItem,
  getCarouselItemById,
  listCarouselItems,
  updateCarouselItem,
  archiveCarouselItem,
  unarchiveCarouselItem,
  createCarouselSlide,
  listCarouselSlides,
  updateCarouselSlide,
  removeCarouselSlide,
};
