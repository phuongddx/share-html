# Phase 2: Add Markdown File Support — Backend

## Context Links

- Upload API: `app/api/upload/route.ts`
- Dropzone: `components/upload-dropzone.tsx`
- Text extraction: `lib/extract-text.ts`
- Share type: `types/share.ts`
- Schema: `supabase/schema.sql`

## Overview

- Priority: High
- Status: Completed
- Extend upload pipeline to accept `.md` files alongside `.html/.htm`.

## Key Insights

- `mime_type` column already exists in `shares` table — just need to store `text/markdown`
- Text extraction from markdown = the raw text itself (no HTML stripping needed)
- Same storage bucket can hold both file types — no bucket changes needed
- Rate limiting, slug generation, delete token — all unchanged

## Requirements

- Upload API accepts `.md` files with `text/markdown` MIME type
- Dropzone accepts `.md` in file picker
- DB record stores correct `mime_type`
- Text extraction handles both HTML and markdown

## Related Code Files

| Action | File | Change |
|--------|------|--------|
| Modify | `app/api/upload/route.ts` | Add `.md` extension + `text/markdown` MIME |
| Modify | `components/upload-dropzone.tsx` | Add `.md` to accept config |
| Modify | `lib/extract-text.ts` | Handle markdown text extraction |

## Implementation Steps

1. In `app/api/upload/route.ts`:
   - Update `ALLOWED_EXTENSIONS` to `[".html", ".htm", ".md"]`
   - Update MIME validation to accept both `text/html` and `text/markdown`:
     ```typescript
     const ALLOWED_MIME_TYPES = ["text/html", "text/markdown"];
     // ...
     if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
       return NextResponse.json(
         { error: "Invalid content type. Only .html and .md files are accepted." },
         { status: 400 },
       );
     }
     ```
   - Determine `contentType` for storage based on file type:
     ```typescript
     const isMarkdown = lowerName.endsWith(".md");
     const mimeType = isMarkdown ? "text/markdown" : "text/html";
     ```
   - Use `mimeType` in both storage upload and DB insert

2. In `components/upload-dropzone.tsx`:
   - Update accept config:
     ```typescript
     accept: { "text/html": [".html", ".htm"], "text/markdown": [".md"] },
     ```
   - Update error messages to mention `.md`:
     ```typescript
     "Only .html/.htm/.md files under 50MB are accepted."
     ```

3. In `lib/extract-text.ts`:
   - If content is markdown (no HTML tags), return content directly
   - Existing HTML extraction logic handles `.html` files unchanged
   - Add a simple check: if no `<` characters found, treat as plain text (markdown)

## Success Criteria

- [ ] `.md` files upload successfully and get stored
- [ ] DB `mime_type` correctly set to `text/markdown`
- [ ] `.md` content extracted for search indexing
- [ ] Dropzone file picker shows `.md` files
- [ ] Error messages reference all accepted types

## Risk Assessment

- **MIME type sniffing**: Some browsers may send `application/octet-stream` for `.md`. Handle gracefully — if `file.type` is empty/falsy, allow based on extension alone.
- **Storage path**: Currently `{uuid}.html` — should change to `{uuid}.md` for markdown files. Use `isMarkdown` flag to determine extension.

## Security Considerations

- Markdown is plain text — lower XSS risk than HTML
- Storage path should use correct extension for content-type accuracy
