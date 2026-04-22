# Code Review: Upload Size Increase & Markdown Support

**Date:** 2026-04-22
**Reviewer:** code-reviewer
**Rating:** 7.5/10
**Commit:** e037886

## Scope

- Files: 8 core files reviewed (upload-dropzone, upload route, extract-text, shiki-highlighter, markdown-viewer, markdown-viewer-wrapper, markdown-viewer.css, share page)
- LOC: ~480 (new + modified)
- Focus: Security, correctness, code quality of 50MB upload + markdown rendering feature
- Scout findings: 4 edge cases identified

## Overall Assessment

Solid, well-structured feature addition. Backend validation is layered (extension + MIME + size). Compensating transaction on DB failure is correct. Shiki is lazy-loaded via singleton promise. Markdown rendering uses react-markdown (sanitizes by default). Dynamic import with skeleton prevents Shiki from blocking initial paint. A few security and correctness items below warrant attention.

## Critical Issues

### C1. `dangerouslySetInnerHTML` with Shiki output — unvalidated HTML injection vector

**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/markdown-viewer.tsx:77`

Shiki's `codeToHtml` is called with user-controlled `code` string. While Shiki itself escapes input, the result is injected raw. If a Shiki version has an escaping bug or if the fallback path (`lang: "text"`) behaves differently, user markdown content becomes raw HTML in the DOM.

**Impact:** Potential XSS if Shiki escaping is bypassed.
**Mitigation:** Low probability — Shiki is well-maintained and specifically designed for this. The `code` is extracted from markdown AST via react-markdown, which strips raw HTML by default (rehype-raw not installed). Acceptable risk, but worth adding a DOMPurify pass on `html` before setting state as defense-in-depth.

### C2. Markdown files pass through `extractTextFromHtml` which uses heuristic HTML detection

**File:** `/Users/ddphuong/Projects/next-labs/share-html/lib/extract-text.ts:35`

Detection is `!content.includes("<")`. A markdown file containing literal `<` (e.g., `<details>`, comparison operators like `a < b`) is routed to the HTML stripping path, which drops content between angle brackets. This corrupts search indexing for valid markdown that contains `<` characters.

**Impact:** Search index data loss for markdown files with angle brackets.
**Fix:** The upload route already determines `isMarkdown` from extension. Pass this flag to the extraction function instead of relying on heuristic detection.

```typescript
// route.ts line 102 — pass the flag:
const contentText = isMarkdown
  ? extractTextFromMarkdown(fileContent)
  : extractTextFromHtml(fileContent);
```

Export `extractTextFromMarkdown` and call it directly when file is `.md`.

## High Priority

### H1. `file_size` column is `INTEGER` — max value 2.1GB, but 50MB uploads are fine

**File:** `/Users/ddphuong/Projects/next-labs/share-html/supabase/schema.sql:13`

`file_size INTEGER` stores bytes. PostgreSQL `INTEGER` max is ~2.1GB. 50MB fits fine today, but if limits increase past 2GB, this will overflow silently. Not blocking now — just flag for awareness.

### H2. No file content validation for markdown — arbitrary text stored as-is

**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/upload/route.ts:94-108`

HTML files get no content sanitization before storage either (they render in a sandboxed iframe). For markdown, this is fine since react-markdown sanitizes on render. However, `fileContent` (up to 50MB) is loaded entirely into memory as a string via `arrayBuffer` + `TextDecoder`, then stored. For Vercel serverless functions with 1024MB default, 50MB files are within limits, but concurrent large uploads could pressure memory.

**Impact:** Memory pressure under concurrent uploads of large files.
**Suggestion:** Consider streaming uploads to storage instead of buffering the full file in memory. Not blocking for current scale.

### H3. Share page does not differentiate expired shares from non-existent shares

**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/s/[slug]/page.tsx:61-63`

Both cases return `notFound()`. Users who had a valid link that expired get a generic 404 with no explanation. Not a bug, but a UX issue.

## Medium Priority

### M1. Shiki highlighter singleton never rejects — errors silently swallowed

**File:** `/Users/ddphuong/Projects/next-labs/share-html/lib/shiki-highlighter.ts:8`

If `createHighlighterCore` throws (e.g., network failure loading WASM), the promise rejects but is never caught. The `CodeBlock` component calls `getHighlighter().then(...)` with a catch that falls back to `lang: "text"`, so the code block still renders. But the error is silently eaten. Consider logging the rejection.

### M2. `CodeBlock` `inline` prop detection relies on react-markdown internal behavior

**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/markdown-viewer.tsx:41`

The `inline` prop in react-markdown v10 is no longer officially documented. The component uses `className` presence (`language-*`) as the discriminator, which is correct for fenced code blocks. However, the `inline` prop may not be passed at all in future react-markdown versions. The `className` check is the reliable signal.

### M3. Theme detection runs per `CodeBlock` instance — N MutationObservers for N code blocks

**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/markdown-viewer.tsx:16-33`

Each `CodeBlock` mounts a `MutationObserver` on `document.documentElement`. For a markdown document with 20 code blocks, that is 20 observers. Not a performance issue at typical scale, but a single shared context would be cleaner.

### M4. `markdown-viewer.css` uses `display: block` on tables — breaks table layout

**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/markdown-viewer.css:93-94`

```css
.markdown-body table {
  display: block;  /* enables overflow-x scroll */
}
```

`display: block` on `<table>` breaks native column width distribution. Rows may not align across cells. Use `display: table` and wrap in a scrollable `<div>` instead, or use `overflow-x: auto` on a wrapper.

## Low Priority

### L1. `getClientIp` trusts `x-forwarded-for` rightmost entry

**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/upload/route.ts:31`

Comment says "rightmost is trusted proxy" — correct for Vercel's infrastructure, but the code takes `entries[entries.length - 1]` which is the rightmost. This is correct for Vercel but would be wrong for other proxy chains where leftmost is the client. Fine for this deployment target.

### L2. `maxDuration = 60` is set but not needed on Vercel hobby plan

**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/upload/route.ts:15`

Vercel hobby plan serverless functions cap at 10s for HTTP. Pro plan allows 60s. This is a no-op on hobby — uploads of large files may timeout. Not a code bug, but worth documenting the deployment requirement.

### L3. Upload dropzone accepts `"text/markdown"` MIME but browsers rarely send it

**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/upload-dropzone.tsx:84`

Browsers typically send `application/octet-stream` or `text/plain` for `.md` files. The backend correctly handles this (`if (file.type && ...)`), but the dropzone's `accept` prop filters by MIME type. react-dropzone checks both MIME and extension, so `.md` extension matching should work. Verified: react-dropzone v15 matches on extension when MIME does not match.

## Edge Cases Found by Scout

1. **Markdown with HTML fragments**: A `.md` file containing `<script>alert(1)</script>` — react-markdown strips raw HTML by default (no rehype-raw). Safe.
2. **Binary file renamed to .md**: Passes extension check, `TextDecoder({ fatal: true })` will throw on non-UTF-8 bytes, caught by the outer try-catch, returns 500. Acceptable but could give a clearer error.
3. **Empty .md file**: `extractTextFromMarkdown("")` returns `""`. Stored and rendered as empty. No crash. Fine.
4. **Concurrent view count + expiry**: `increment_view_count` RPC runs before expiry check in page.tsx (line 66 vs 61). Actually, expiry check is first — this is correct.

## Positive Observations

1. **Compensating transaction pattern** (route.ts lines 141-152): If DB insert fails after storage upload, storage object is cleaned up. Well-implemented with CRITICAL log on double-failure.
2. **Defense-in-depth on upload validation**: Extension + MIME + size checks. MIME check is lenient for `.md` (handles browser inconsistency).
3. **Shiki singleton with lazy init**: Avoids loading syntax highlighting on every request. Clean pattern.
4. **Dynamic import with loading skeleton**: Prevents Shiki bundle from blocking initial paint. Good UX.
5. **Sandboxed iframe for HTML**: Existing HTML viewer uses CSP + sandbox. Markdown is safe via react-markdown's default sanitization.
6. **Rate limiting**: Preserved from original implementation. Graceful fallback when Upstash not configured.

## Recommended Actions

1. **[Critical]** Fix markdown text extraction heuristic — pass `isMarkdown` flag from upload route to avoid misrouting markdown with `<` characters.
2. **[High]** Consider defense-in-depth DOMPurify pass on Shiki output before `dangerouslySetInnerHTML`.
3. **[Medium]** Extract theme detection into a shared context/hook to avoid N MutationObservers.
4. **[Medium]** Fix table CSS `display: block` to preserve column alignment.
5. **[Low]** Document that `maxDuration = 60` requires Vercel Pro plan for large uploads.

## Metrics

- Type Coverage: TypeScript strict, all interfaces defined — ~90%
- Test Coverage: No test files in this changeset — 0%
- Linting Issues: Not run (no test/lint step verified)
- Security: No secrets leaked, XSS mitigated, rate limiting in place

## Unresolved Questions

1. Is the Vercel deployment on Pro plan? Hobby plan 10s timeout may be insufficient for 50MB uploads.
2. Is there a Supabase Storage bucket size limit configured server-side to enforce 50MB at the infrastructure level, or is it only enforced in application code?
3. Should expired shares show a distinct "expired" message instead of a generic 404?
