---
name: live-smoke-test
description: Run a reusable live-browser smoke test checklist against a BloomOS module (create/list/detail/edit/status transitions/notes/timeline/search/filters/isolation). Use when the user says "use live-smoke-test for X", asks to verify a module actually works in the browser, or after any module-ui work before it's reported as done. Follows the permanent desktop+mobile QA policy — never report a check that wasn't actually performed.
---

# Live smoke test

A reusable checklist for verifying a module actually works end to end in a real browser session, not just that it typechecks and its unit tests pass. This is the browser-verification half of the permanent BloomOS QA policy: **only report a check that was actually performed**, in the exact reporting format below — a missing verification is fine, a fabricated one is never acceptable.

## Checklist

- Authenticate with the existing owner session — never request a password in chat; use a session already available, or hand this step to the user if none is.
- Create a record **through the UI**, not by inserting directly into the database.
- Verify it appears in the list view.
- Refresh the page and confirm it persisted (catches state that only looked saved because it was still in memory).
- Open its detail view.
- Edit it and confirm the change round-trips.
- Exercise at least one workflow status transition specific to this module.
- Add a Note, confirm it appears, confirm pin/unpin if the module supports it.
- Confirm a Timeline entry was recorded for the actions above.
- Exercise search.
- Exercise at least one filter.
- Exercise sorting, if the list view supports it.
- Check archived/terminal-state behavior (an archived/converted/closed record behaves as read-only or excluded, per that module's own rules).
- Check the browser console for errors.
- Check for any server 500s in network requests or server logs.
- Confirm Workspace isolation if a second Workspace/tenant context is available to test against; otherwise skip this line rather than fabricate it.

Do not create test records through raw SQL unless the user explicitly authorizes it for that specific check — SQL-inserted records skip the exact UI code path this checklist exists to exercise.

## Reporting format (mandatory, not optional)

```
Live Verification
✓ Desktop verified
(list the actual checks performed)
✓ Mobile verified
(list the actual checks performed)
Chrome: Verified
Safari: Not verified (Safari automation unavailable)
```

If no UI changed in this task, say exactly: "No browser verification performed because this task did not modify the UI." If a check from the list above wasn't actually run, it doesn't appear as verified — omit it rather than imply it happened.
