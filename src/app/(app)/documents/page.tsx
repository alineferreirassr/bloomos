import { DocumentsListView } from "@/modules/documents/components/DocumentsListView";
import type { EntityType } from "@/core/enums/entityType";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerType?: string; ownerId?: string; folderId?: string }>;
}) {
  const { ownerType, ownerId, folderId } = await searchParams;
  return (
    <DocumentsListView
      initialOwnerType={ownerType as EntityType | undefined}
      initialOwnerId={ownerId}
      initialFolderId={folderId}
    />
  );
}
