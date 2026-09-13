import type { ScriptItem } from "@/types/scriptItem";

let scriptItems: ScriptItem[] = [];

export function readScriptItems(): ScriptItem[] {
  return scriptItems;
}

export function writeScriptItems(next: ScriptItem[]): void {
  scriptItems = next;
}

export function resetScriptItemsStore(): void {
  scriptItems = [];
}
