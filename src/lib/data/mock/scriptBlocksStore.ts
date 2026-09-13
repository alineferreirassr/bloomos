import type { ScriptBlock } from "@/types/scriptBlock";

let scriptBlocks: ScriptBlock[] = [];

export function readScriptBlocks(): ScriptBlock[] {
  return scriptBlocks;
}

export function writeScriptBlocks(next: ScriptBlock[]): void {
  scriptBlocks = next;
}

export function resetScriptBlocksStore(): void {
  scriptBlocks = [];
}
