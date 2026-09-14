import type { AIGeneration } from "@/types/aiGeneration";

let aiGenerations: AIGeneration[] = [];

export function readAIGenerations(): AIGeneration[] {
  return aiGenerations;
}

export function writeAIGenerations(next: AIGeneration[]): void {
  aiGenerations = next;
}

export function resetAIGenerationsStore(): void {
  aiGenerations = [];
}
