import type { ScriptVersion } from "@/types/scriptVersion";

let scriptVersions: ScriptVersion[] = [];

export function readScriptVersions(): ScriptVersion[] {
  return scriptVersions;
}

export function writeScriptVersions(next: ScriptVersion[]): void {
  scriptVersions = next;
}

export function resetScriptVersionsStore(): void {
  scriptVersions = [];
}
