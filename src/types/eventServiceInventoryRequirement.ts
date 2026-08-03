/** Generated from ServiceInventoryTemplateItem at assignment time — "this Event needs N of X." Never decrements real Inventory quantities itself; `is_fulfilled` is a human-set flag once the need has actually been met against real stock (a real `record_inventory_movement` call, done separately, through Inventory's own flow). */
export interface EventServiceInventoryRequirement {
  id: string;
  workspace_id: string;
  event_service_id: string;
  inventory_item_id: string | null;
  item_name: string;
  quantity: number;
  is_fulfilled: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}
