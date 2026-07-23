import { InventoryItemDetailView } from "@/modules/inventory/components/InventoryItemDetailView";

export default async function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ inventoryItemId: string }>;
}) {
  const { inventoryItemId } = await params;
  return <InventoryItemDetailView key={inventoryItemId} inventoryItemId={inventoryItemId} />;
}
