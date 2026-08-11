import { describe, expect, it } from "vitest";
import { buildTimeOfDayGreeting, buildWelcomeCopy, resolveTimeOfDay } from "@/core/dashboard/buildWelcomeCopy";

describe("resolveTimeOfDay", () => {
  it("returns morning before noon", () => {
    expect(resolveTimeOfDay(new Date(2026, 0, 1, 9, 0))).toBe("morning");
  });

  it("returns afternoon between noon and 6pm", () => {
    expect(resolveTimeOfDay(new Date(2026, 0, 1, 14, 0))).toBe("afternoon");
  });

  it("returns evening after 6pm", () => {
    expect(resolveTimeOfDay(new Date(2026, 0, 1, 20, 0))).toBe("evening");
  });
});

describe("buildWelcomeCopy", () => {
  it("builds an owner greeting with a time-of-day + workspace subtitle", () => {
    const copy = buildWelcomeCopy({ experience: "owner", firstName: "Aline", timeOfDay: "morning", workspaceName: "Amoré Bloom" });
    expect(copy.greeting).toBe("Good morning, Aline");
    expect(copy.subtitle).toBe("Here's what's happening across Amoré Bloom today.");
  });

  it("builds a team greeting with singular task/event counts", () => {
    const copy = buildWelcomeCopy({ experience: "team", firstName: "Sophia", timeOfDay: "morning", taskCount: 1, eventCount: 1 });
    expect(copy.greeting).toBe("Good morning, Sophia");
    expect(copy.subtitle).toBe("Here's your plan for today. You've got 1 task and 1 event.");
  });

  it("builds a team greeting with plural task/event counts", () => {
    const copy = buildWelcomeCopy({ experience: "team", firstName: "Sophia", timeOfDay: "afternoon", taskCount: 4, eventCount: 2 });
    expect(copy.subtitle).toBe("Here's your plan for today. You've got 4 tasks and 2 events.");
  });

  it("builds a client welcome without a time-of-day greeting", () => {
    const copy = buildWelcomeCopy({ experience: "client", firstName: "Michael", subjectLabel: "proposal" });
    expect(copy.greeting).toBe("Welcome, Michael");
    expect(copy.subtitle).toBe("Here's everything about your proposal. We've got it all under control.");
  });

  it("defaults to the real current time of day when none is supplied", () => {
    const copy = buildWelcomeCopy({ experience: "owner", firstName: "Aline", workspaceName: "Amoré Bloom" });
    expect(copy.greeting).toMatch(/^Good (morning|afternoon|evening), Aline$/);
  });
});

describe("buildTimeOfDayGreeting", () => {
  it("interpolates the first name and each explicit time of day", () => {
    expect(buildTimeOfDayGreeting("Aline", "morning")).toBe("Good morning, Aline");
    expect(buildTimeOfDayGreeting("Aline", "afternoon")).toBe("Good afternoon, Aline");
    expect(buildTimeOfDayGreeting("Aline", "evening")).toBe("Good evening, Aline");
  });

  it("defaults to the real current time of day when none is supplied", () => {
    expect(buildTimeOfDayGreeting("Aline")).toMatch(/^Good (morning|afternoon|evening), Aline$/);
  });

  it("is the same formatting buildWelcomeCopy uses for the owner/team experiences", () => {
    const owner = buildWelcomeCopy({ experience: "owner", firstName: "Aline", timeOfDay: "evening", workspaceName: "Amoré Bloom" });
    expect(owner.greeting).toBe(buildTimeOfDayGreeting("Aline", "evening"));
  });
});
