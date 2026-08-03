import type { Tag, TagAssignment } from "@/types/tag";
import type { EntityType } from "@/core/enums/entityType";
import type { CreateTagInput, TagsRepository } from "@/lib/data/core/tags/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let tags: Tag[] = [];
let assignments: TagAssignment[] = [];

/** Test-only: restore both stores to empty between test cases. */
export function resetTagsStore(): void {
  tags = [];
  assignments = [];
}

async function getTags(workspaceId: string): Promise<Tag[]> {
  await delay(100);
  return tags.filter((tag) => tag.workspace_id === workspaceId).sort((a, b) => a.label.localeCompare(b.label));
}

async function createTag(workspaceId: string, actor: string, input: CreateTagInput): Promise<DataResult<Tag>> {
  const label = input.label.trim();
  if (label.length === 0) {
    return fail("Please fix the highlighted fields.", { label: "Label is required" });
  }
  const duplicate = tags.some((tag) => tag.workspace_id === workspaceId && tag.label.toLowerCase() === label.toLowerCase());
  if (duplicate) {
    return fail("Please fix the highlighted fields.", { label: "A tag with this label already exists" });
  }

  const tag: Tag = {
    id: generateId("tag"),
    workspace_id: workspaceId,
    label,
    color: input.color ?? null,
    created_by: actor,
    created_at: nowIso(),
  };
  tags = [...tags, tag];
  return ok(tag);
}

async function deleteTag(id: string): Promise<DataResult<Tag>> {
  const existing = tags.find((tag) => tag.id === id);
  if (!existing) return fail("Tag not found.");
  tags = tags.filter((tag) => tag.id !== id);
  assignments = assignments.filter((assignment) => assignment.tag_id !== id);
  return ok(existing);
}

async function getTagsForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<Tag[]> {
  await delay(100);
  const tagIds = new Set(
    assignments
      .filter((a) => a.workspace_id === workspaceId && a.owner_type === ownerType && a.owner_id === ownerId)
      .map((a) => a.tag_id),
  );
  return tags.filter((tag) => tagIds.has(tag.id));
}

async function assignTag(
  workspaceId: string,
  actor: string,
  tagId: string,
  ownerType: EntityType,
  ownerId: string,
): Promise<DataResult<TagAssignment>> {
  if (!tags.some((tag) => tag.id === tagId && tag.workspace_id === workspaceId)) {
    return fail("Tag not found.");
  }
  const existing = assignments.find(
    (a) => a.tag_id === tagId && a.owner_type === ownerType && a.owner_id === ownerId && a.workspace_id === workspaceId,
  );
  if (existing) return ok(existing);

  const assignment: TagAssignment = {
    id: generateId("tag_assignment"),
    workspace_id: workspaceId,
    tag_id: tagId,
    owner_type: ownerType,
    owner_id: ownerId,
    created_by: actor,
    created_at: nowIso(),
  };
  assignments = [...assignments, assignment];
  return ok(assignment);
}

async function removeTagAssignment(id: string): Promise<DataResult<TagAssignment>> {
  const existing = assignments.find((a) => a.id === id);
  if (!existing) return fail("Tag assignment not found.");
  assignments = assignments.filter((a) => a.id !== id);
  return ok(existing);
}

async function getOwnersForTag(tagId: string): Promise<TagAssignment[]> {
  await delay(100);
  return assignments.filter((a) => a.tag_id === tagId);
}

export const mockTagsRepository: TagsRepository = {
  getTags,
  createTag,
  deleteTag,
  getTagsForOwner,
  assignTag,
  removeTagAssignment,
  getOwnersForTag,
};
