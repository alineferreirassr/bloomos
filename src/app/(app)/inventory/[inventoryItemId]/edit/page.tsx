import { EditInventoryItemView } from "@/modules/inventory/components/EditInventoryItemView";

export default async function EditInventoryItemPage({
  params,
}: {
  params: Promise<{ inventoryItemId: string }>;
}) {
  const { inventoryItemId } = await params;
  return <EditInventoryItemView inventoryItemId={inventoryItemId} />;
}
