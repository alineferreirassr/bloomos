import { FolderDetailView } from "@/modules/documents/components/FolderDetailView";

export default async function DocumentFolderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FolderDetailView key={id} folderId={id} />;
}
