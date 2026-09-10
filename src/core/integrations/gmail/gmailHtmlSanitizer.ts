import DOMPurify from "isomorphic-dompurify";

/**
 * GMAIL-07 — the one place `gmail_messages.body_html` is ever sanitized,
 * called server-side inside the read-only inbox data loaders
 * (`getGmailInboxActions.ts`) before the HTML ever reaches a Client
 * Component — so the raw provider HTML is never even transmitted to the
 * browser, not just "sanitized before render." Uses `isomorphic-dompurify`
 * (DOMPurify + a bundled jsdom for Node) — no existing sanitizer or
 * `dangerouslySetInnerHTML` precedent existed anywhere in this codebase
 * before this file (confirmed via a read-only audit first); this is a
 * newly-introduced, narrowly-scoped dependency, not a custom ad-hoc
 * sanitizer.
 *
 * Policy, deliberately conservative for a first read-only checkpoint:
 * - A small allowlist of structural/text-formatting tags only — no
 *   `<img>` at all (this is how "block remote image loading by default"
 *   is satisfied: no image renders, remote or local/data-URI, full stop
 *   — see GMAIL-07I's own instruction; a future checkpoint could allow
 *   `data:` image URIs specifically if that's ever wanted).
 * - No `style`, `class` restricted to nothing meaningful (email HTML's
 *   own inline styling is dropped entirely, not sanitized-and-kept, to
 *   guarantee it can never break this app's own layout).
 * - Every `<a href>` DOMPurify keeps already passed DOMPurify's own safe
 *   URI allowlist (blocks `javascript:`/`data:`/etc. hrefs by default);
 *   this file's own `afterSanitizeAttributes` hook additionally forces
 *   `target="_blank" rel="noopener noreferrer nofollow"` on every one.
 */

const ALLOWED_TAGS = [
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "p",
  "br",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "hr",
  "pre",
  "code",
];

const ALLOWED_ATTR = ["href", "colspan", "rowspan"];

/** Explicit even where redundant with `ALLOWED_TAGS`'s own omissions — documents intent and stays correct even if `ALLOWED_TAGS` is ever loosened without this list being reconsidered. */
const FORBID_TAGS = ["script", "style", "iframe", "object", "embed", "form", "input", "button", "img", "svg", "math", "link", "meta", "video", "audio", "source"];
const FORBID_ATTR = ["style", "class", "onerror", "onload", "onclick", "onmouseover", "srcset"];

let linkSafetyHookInstalled = false;

function ensureLinkSafetyHook(): void {
  if (linkSafetyHookInstalled) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
  linkSafetyHookInstalled = true;
}

/**
 * Sanitizes one Gmail message's `body_html` for safe, contained
 * rendering. Never called with `IN_PLACE` (the DOMPurify mode a known
 * moderate advisory applies to — see this repo's own `npm audit`
 * history) and never mutates the input string itself. Returns an empty
 * string for empty/whitespace-only input rather than `null` — callers
 * decide their own empty-body fallback chain (see `getGmailInboxActions.ts`).
 */
export function sanitizeGmailHtml(rawHtml: string): string {
  ensureLinkSafetyHook();
  const result = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
  return typeof result === "string" ? result : String(result);
}
