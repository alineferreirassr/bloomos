"use client";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { PlusIcon } from "@/components/ui/icons";

interface TemplateCategoryToolbarProps {
  itemNoun: string;
  disabled: boolean;
  disabledReason?: string;
  onAdd: () => void;
}

export function TemplateCategoryToolbar({ itemNoun, disabled, disabledReason, onAdd }: TemplateCategoryToolbarProps) {
  if (disabled) {
    return (
      <Tooltip content={disabledReason ?? "This can't be edited right now."}>
        <Button type="button" variant="secondary" aria-disabled="true" onClick={(event) => event.preventDefault()} className="cursor-not-allowed opacity-45">
          <PlusIcon className="h-3.5 w-3.5" /> Add {itemNoun}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button type="button" variant="secondary" onClick={onAdd}>
      <PlusIcon className="h-3.5 w-3.5" /> Add {itemNoun}
    </Button>
  );
}
