# Project Changelog

All notable changes to the Share HTML platform.

## [2026-04-22] Upload Size Increase & Markdown Support

### Added
- **Markdown file upload**: Platform now accepts `.md` files alongside `.html/.htm`
- **Markdown viewer**: Client-side rendering with react-markdown + remark-gfm + shiki syntax highlighting
- **Preview/raw toggle**: Switch between rendered markdown preview and raw source view
- **GitHub-like prose styling**: Custom CSS for headings, tables, code blocks, blockquotes, task lists
- **Lazy-loaded viewer**: MarkdownViewer loaded via next/dynamic only when viewing .md files

### Changed
- **Upload size limit**: Increased from 10MB to 50MB (client dropzone, server API, Supabase bucket)
- **Upload API**: Extended to accept `.md` extension and `text/markdown` MIME type
- **Text extraction**: `lib/extract-text.ts` now handles markdown content for search indexing
- **Storage paths**: Markdown files stored as `{uuid}.md` in Supabase storage

### Dependencies Added
- `react-markdown` — markdown parsing and rendering
- `remark-gfm` — GitHub Flavored Markdown support
- `shiki` — syntax highlighting with JS regex engine

### Files Modified
- `components/upload-dropzone.tsx` — 50MB limit, .md acceptance
- `app/api/upload/route.ts` — 50MB limit, .md MIME handling
- `lib/extract-text.ts` — markdown text extraction
- `app/s/[slug]/page.tsx` — viewer routing by mime_type

### Files Created
- `components/markdown-viewer.tsx` — markdown viewer component
- `components/markdown-viewer-wrapper.tsx` — dynamic import wrapper
- `app/markdown-viewer.css` — GitHub-like prose styles
- `lib/shiki-highlighter.ts` — shiki singleton with curated languages

---

## [2026-04-22] Initial Platform Release

### Core Features
- HTML file upload with drag-and-drop interface
- Share link generation using nanoid slugs (10-character)
- Sandboxed HTML viewer with CSP headers
- Full-text search with pagination
- Light/dark theme switching
- Rate limiting (10 req/min per IP via Upstash Redis)
- 30-day automatic file expiration
- Delete token-based authorization
- Responsive design (mobile-friendly)

### Tech Stack
- Next.js 16.2.4 with App Router
- React 19, TypeScript 5
- Supabase (PostgreSQL + Storage)
- Tailwind CSS 4, shadcn/ui
- Vercel deployment
