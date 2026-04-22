# Phase 4: Integrate Viewer Routing & Polish

## Context Links

- Share page: `app/s/[slug]/page.tsx`
- HTML viewer: `components/html-viewer.tsx`
- Markdown viewer: `components/markdown-viewer.tsx` (created in Phase 3)
- Share link component: `components/share-link.tsx`

## Overview

- Priority: Medium
- Status: Completed
- Route viewer rendering based on file type, add visual polish, verify end-to-end.

## Key Insights

- Share page is a server component — needs to branch rendering based on `mime_type`
- MarkdownViewer is client-side (uses React hooks) — use `next/dynamic` with `ssr: false`
- Storage bucket name "html-files" is slightly misleading now but renaming requires migration — leave as-is (KISS)

## Requirements

- Share page renders HtmlViewer for `.html`, MarkdownViewer for `.md`
- Viewer header shows file type badge
- Smooth UX: loading state while lazy component loads
- All existing functionality preserved (view count, expiry, metadata)

## Related Code Files

| Action | File | Change |
|--------|------|--------|
| Modify | `app/s/[slug]/page.tsx` | Branch rendering by mime_type |
| Modify | `README.md` | Update features to mention markdown |

## Implementation Steps

1. In `app/s/[slug]/page.tsx`:
   - Import HtmlViewer (existing) and lazy-load MarkdownViewer:
     ```typescript
     import dynamic from "next/dynamic";
     const MarkdownViewer = dynamic(
       () => import("@/components/markdown-viewer").then((m) => m.MarkdownViewer),
       { ssr: false, loading: () => <LoadingSkeleton /> }
     );
     ```
   - After fetching file content, branch by `share.mime_type`:
     ```tsx
     {share.mime_type === "text/markdown" ? (
       <MarkdownViewer content={fileContent} />
     ) : (
       <HtmlViewer htmlContent={fileContent} />
     )}
     ```
   - Add a small file type badge in the metadata header (HTML/MD)
   - Create a simple `LoadingSkeleton` for the lazy load state

2. In `README.md`:
   - Update Features section:
     - "Upload: Drag-and-drop HTML and Markdown files (up to 50MB)"
   - Add markdown to tech features list if applicable

## Success Criteria

- [ ] HTML files render in existing iframe viewer (regression check)
- [ ] Markdown files render in new MarkdownViewer
- [ ] Lazy loading shows skeleton, no layout shift
- [ ] File type visible in metadata header
- [ ] View count, expiry, delete still work for both types
- [ ] Search works for both HTML and markdown content

## Risk Assessment

- **Server component constraints**: MarkdownViewer must be client-only (`ssr: false`) because it uses hooks and shiki (WASM-like init). Handled by `next/dynamic`.
- **Storage bucket name**: "html-files" now stores `.md` too. Misleading but harmless. Rename in a future cleanup if desired.

## Security Considerations

- Markdown rendered via react-markdown — inherently safer than HTML iframe
- No new CSP concerns for markdown (no iframe needed)
