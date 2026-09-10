import { describe, expect, it } from "vitest";
import { sanitizeGmailHtml } from "@/core/integrations/gmail/gmailHtmlSanitizer";

describe("sanitizeGmailHtml — malicious content removal", () => {
  it("removes <script> tags entirely, including their content", () => {
    const result = sanitizeGmailHtml('<p>Hello</p><script>alert("xss")</script>');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(");
    expect(result).toContain("Hello");
  });

  it("removes <iframe> tags", () => {
    const result = sanitizeGmailHtml('<p>Hi</p><iframe src="https://evil.example.com"></iframe>');
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("evil.example.com");
  });

  it("removes <object> and <embed> tags", () => {
    const result = sanitizeGmailHtml('<object data="evil.swf"></object><embed src="evil.swf">');
    expect(result).not.toContain("<object");
    expect(result).not.toContain("<embed");
  });

  it("removes <form>, <input>, and <button> tags", () => {
    const result = sanitizeGmailHtml('<form action="https://evil.example.com"><input name="x"><button>Submit</button></form>');
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).not.toContain("<button");
  });

  it("strips inline event handler attributes (onerror, onclick, onload, onmouseover)", () => {
    const result = sanitizeGmailHtml('<p onclick="alert(1)">Click me</p><div onmouseover="steal()">hover</div>');
    expect(result).not.toMatch(/onclick/i);
    expect(result).not.toMatch(/onmouseover/i);
    expect(result).not.toContain("alert(1)");
    expect(result).not.toContain("steal()");
  });

  it("rejects javascript: URLs in href", () => {
    const result = sanitizeGmailHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toMatch(/javascript:/i);
  });

  it("removes <style> tags and inline style attributes (never lets email CSS break app layout)", () => {
    const result = sanitizeGmailHtml('<style>body{display:none}</style><p style="position:fixed;top:0">Hi</p>');
    expect(result).not.toContain("<style");
    expect(result).not.toMatch(/style\s*=/);
  });

  it("removes class attributes (email HTML cannot target this app's own CSS classes)", () => {
    const result = sanitizeGmailHtml('<p class="luxury-card">Hi</p>');
    expect(result).not.toMatch(/class\s*=/);
  });

  it("removes svg/math tags (known DOMPurify bypass vectors)", () => {
    const result = sanitizeGmailHtml("<svg><script>alert(1)</script></svg><math><script>alert(2)</script></math>");
    expect(result).not.toContain("<svg");
    expect(result).not.toContain("<math");
    expect(result).not.toContain("alert(");
  });

  it("removes video/audio/source tags", () => {
    const result = sanitizeGmailHtml('<video src="x.mp4"></video><audio src="x.mp3"></audio>');
    expect(result).not.toContain("<video");
    expect(result).not.toContain("<audio");
  });
});

describe("sanitizeGmailHtml — remote image policy", () => {
  it("removes <img> tags entirely, remote or otherwise — no image loads at all", () => {
    const result = sanitizeGmailHtml('<p>Hi</p><img src="https://tracker.example.com/pixel.gif" width="1" height="1">');
    expect(result).not.toContain("<img");
    expect(result).not.toContain("tracker.example.com");
  });

  it("removes a data: URI image the same way — no allowlist carve-out this checkpoint", () => {
    const result = sanitizeGmailHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(result).not.toContain("<img");
  });
});

describe("sanitizeGmailHtml — safe content is retained", () => {
  it("keeps basic formatting: paragraphs, bold, italics, line breaks, lists", () => {
    const result = sanitizeGmailHtml("<p>Hi <b>Ana</b>, <i>following up</i> on the booking.</p><ul><li>Item one</li><li>Item two</li></ul>");
    expect(result).toContain("<p>");
    expect(result).toContain("<b>Ana</b>");
    expect(result).toContain("<i>following up</i>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>Item one</li>");
  });

  it("keeps tables (common in Gmail HTML signatures/invoices)", () => {
    const result = sanitizeGmailHtml("<table><tbody><tr><td>Total</td><td>$100</td></tr></tbody></table>");
    expect(result).toContain("<table>");
    expect(result).toContain("<td>Total</td>");
  });

  it("keeps a safe href and forces target=_blank rel=noopener noreferrer nofollow", () => {
    const result = sanitizeGmailHtml('<a href="https://amorebloom.com/booking">View booking</a>');
    expect(result).toContain('href="https://amorebloom.com/booking"');
    expect(result).toContain('target="_blank"');
    expect(result).toMatch(/rel="noopener noreferrer nofollow"/);
  });

  it("keeps headings and blockquotes", () => {
    const result = sanitizeGmailHtml("<h2>Booking Summary</h2><blockquote>Original message</blockquote>");
    expect(result).toContain("<h2>Booking Summary</h2>");
    expect(result).toContain("<blockquote>Original message</blockquote>");
  });
});

describe("sanitizeGmailHtml — edge cases", () => {
  it("returns an empty string for empty input", () => {
    expect(sanitizeGmailHtml("")).toBe("");
  });

  it("handles plain text with no markup safely", () => {
    expect(sanitizeGmailHtml("Just plain text, no tags.")).toContain("Just plain text");
  });

  it("never throws on malformed/unbalanced HTML", () => {
    expect(() => sanitizeGmailHtml("<p>unbalanced <b>tags <i>here")).not.toThrow();
  });
});
