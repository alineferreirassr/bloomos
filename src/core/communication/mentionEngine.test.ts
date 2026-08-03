import { describe, expect, it } from "vitest";
import { parseMentions } from "@/core/communication/mentionEngine";

const roster = [
  { id: "member_1", fullName: "Ana Ferreira" },
  { id: "member_2", fullName: "Ana" },
  { id: "member_3", fullName: "Marina Costa" },
];

describe("parseMentions", () => {
  it("matches a full-name mention", () => {
    expect(parseMentions("Please loop in @Marina Costa on this.", roster)).toEqual({ mentionedMemberIds: ["member_3"], mentionsTeam: false });
  });

  it("prefers the longer name match when a shorter name is a prefix of a longer one", () => {
    expect(parseMentions("@Ana Ferreira can you take this?", roster)).toEqual({ mentionedMemberIds: ["member_1"], mentionsTeam: false });
  });

  it("recognizes @Team as a distinct, non-member-expanding flag", () => {
    expect(parseMentions("@Team heads up, event moved.", roster)).toEqual({ mentionedMemberIds: [], mentionsTeam: true });
  });

  it("deduplicates repeated mentions of the same member", () => {
    const result = parseMentions("@Marina Costa, did you see this? cc @Marina Costa", roster);
    expect(result.mentionedMemberIds).toEqual(["member_3"]);
  });

  it("ignores an @ token that matches no one", () => {
    expect(parseMentions("Email me at contact@example.com", roster)).toEqual({ mentionedMemberIds: [], mentionsTeam: false });
  });

  it("returns nothing for a body with no mentions", () => {
    expect(parseMentions("No mentions here at all.", roster)).toEqual({ mentionedMemberIds: [], mentionsTeam: false });
  });
});
