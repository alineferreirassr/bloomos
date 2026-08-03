import { describe, expect, it } from "vitest";
import { applyWritingAction } from "@/core/ai/copilot/writingEngine";

describe("applyWritingAction", () => {
  it("shortens to the first two sentences and notes how many were dropped", () => {
    const result = applyWritingAction({
      taskType: "email",
      action: "shorten",
      sourceText: "First sentence. Second sentence. Third sentence. Fourth sentence.",
    });
    expect(result.outputText).toBe("First sentence. Second sentence.");
    expect(result.applied).toBe(true);
    expect(result.note).toContain("first 2 of 4");
  });

  it("leaves a two-sentence input alone with no truncation note", () => {
    const result = applyWritingAction({ taskType: "email", action: "shorten", sourceText: "One. Two." });
    expect(result.outputText).toBe("One. Two.");
    expect(result.note).toBeNull();
  });

  it("normalizes whitespace and capitalizes sentences for grammar", () => {
    const result = applyWritingAction({
      taskType: "internal_notes",
      action: "grammar",
      sourceText: "  hello there.   how are you?  ",
    });
    expect(result.outputText).toBe("Hello there. How are you?");
    expect(result.applied).toBe(true);
  });

  it("applies a luxury tone opener", () => {
    const result = applyWritingAction({ taskType: "client_message", action: "luxury_tone", sourceText: "your event is confirmed." });
    expect(result.outputText.startsWith("With warmest regards,")).toBe(true);
    expect(result.applied).toBe(true);
  });

  it("applies a professional tone opener", () => {
    const result = applyWritingAction({ taskType: "client_message", action: "professional_tone", sourceText: "the balance is due friday." });
    expect(result.outputText.startsWith("Please note:")).toBe(true);
  });

  it("applies a friendly tone opener", () => {
    const result = applyWritingAction({ taskType: "client_message", action: "friendly_tone", sourceText: "thanks for your patience." });
    expect(result.outputText.startsWith("Just a quick note —")).toBe(true);
  });

  it("marks translate as not applied and returns the original text unmodified", () => {
    const result = applyWritingAction({ taskType: "email", action: "translate", sourceText: "Hello, world." });
    expect(result.applied).toBe(false);
    expect(result.outputText).toBe("Hello, world.");
    expect(result.note).toMatch(/connected AI provider/);
  });

  it("rewrite applies a light structural cleanup and is honest about its own limits", () => {
    const result = applyWritingAction({ taskType: "proposal", action: "rewrite", sourceText: "we look forward to working with you." });
    expect(result.applied).toBe(true);
    expect(result.note).toMatch(/connected AI provider/);
  });

  it("returns an empty string unchanged for empty input", () => {
    const result = applyWritingAction({ taskType: "email", action: "shorten", sourceText: "   " });
    expect(result.outputText).toBe("");
  });
});
