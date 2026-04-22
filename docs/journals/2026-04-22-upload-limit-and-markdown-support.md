# Upload Limit Increase and Markdown Support -- Verification and Bugfix Session

**Date**: 2026-04-22 ~12:00
**Severity**: Medium
**Component**: File upload pipeline, markdown viewer, text extraction
**Status**: Resolved

## What Happened

Session focused on verifying the "Increase Upload Size & Markdown Support" plan (0422-1038) across all 4 phases. Verification passed on the happy path, but code review uncovered two real bugs that would have shipped to production.

## The Brutal Truth

The first bug was a CSS syntax error (`var(--muted)/30`) -- the kind of thing a linter should have caught but didn't. The second bug was worse: markdown files containing `<` characters were being run through the HTML tag-stripper in `extract-text.ts`, silently destroying content. That is a data-integrity bug masked by a routing assumption. Nobody tested with a markdown file that had angle brackets in it, which is... most markdown files with inline code or HTML snippets.

## Technical Details

**Bug 1 -- Invalid CSS color syntax** in `markdown-viewer.css`:
- `var(--muted)/30` is not valid CSS. CSS custom properties don't support the opacity modifier shorthand the way Tailwind classes do.
- Fix: replaced with `color-mix(in srgb, var(--muted) 30%, transparent)`.

**Bug 2 -- Markdown text extraction destroying content** in `extract-text.ts`:
- The `extractTextFromHTML` function strips HTML tags via regex. Markdown files with `<` characters (code blocks, inline code, HTML snippets) were routed through this stripper, mangling the content.
- Fix: exported `extractTextFromMarkdown` as a separate function. The upload route now branches on `isMarkdown` before choosing which extractor to call.

**Code review score**: 7.5/10. Remaining concerns:
- Memory pressure from buffering 50MB files in Node.js (no streaming -- entire file held in memory during upload/processing).
- Table styling uses `display: block`, breaking proper table layout.

## What We Tried

1. Verified all 4 plan phases end-to-end.
2. Code review surfaced the two bugs above.
3. Fixed both bugs, updated all phase files to "Completed".
4. Synced docs: `project-overview-pdr.md`, `system-architecture.md`, `design-guidelines.md` updated; `project-changelog.md` and `project-roadmap.md` created fresh.

## Root Cause Analysis

Both bugs stem from the same root cause: the markdown feature was bolted onto the existing HTML pipeline without sufficient boundary enforcement. The CSS bug was a Tailwind-ism leaking into raw CSS. The extraction bug was an `if/else` branch that defaulted all file content to HTML processing. The mental model was "files go through the pipeline" rather than "different file types need different pipelines."

## Lessons Learned

- When adding a new file type to an existing upload pipeline, explicitly trace every function in the pipeline and ask: "does this function assume it's dealing with the original file type?" The answer will be yes more often than you think.
- Test with adversarial content. A markdown file with `<script>` or `<div>` tags is the exact case that exposes routing bugs.
- 50MB in-memory buffering is a ticking time bomb under concurrent load. Streaming should be on the roadmap.

## Next Steps

- Address memory pressure: investigate streaming uploads for large files (Supabase Storage resumable uploads).
- Fix table CSS: replace `display: block` with proper table styling.
- Add integration tests for markdown upload that include angle brackets, HTML snippets, and code blocks.
