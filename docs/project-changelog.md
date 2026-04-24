# Project Changelog

All notable changes to DropItX.

---

## [v1.1.0] — 2026-04-24

### Added
- **Markdown editor** (`/editor`): CodeMirror 6 with live split-pane preview (react-markdown + shiki)
- **Editor components**: `EditorShell`, `EditorPane`, `EditorPreview`, `EditorToolbar`, `EditorPublishBar`
- **Editor extensions** (`lib/editor-extensions/`): slash commands, image drag-and-drop
- **Auto-draft**: `useEditorAutoSave` persists editor content to localStorage; dirty-state unload warning
- **Publishing API**: `POST /api/publish` — create share from Markdown content (title, custom_slug, is_private)
- **Inline image upload**: `POST /api/images/upload` — PNG/JPG/GIF/WebP, max 5 MB, auth required
- **REST API v1**: `POST/GET /api/v1/documents`, `GET/PATCH/DELETE /api/v1/documents/[slug]`
- **API key management**: `POST/GET /api/v1/keys`, `DELETE /api/v1/keys/[id]`
- **`ApiKeyManager` component**: Dashboard UI for creating and revoking API keys
- **`lib/api-auth.ts`**: SHA-256 hash + `api_keys` table lookup for Bearer token auth
- **Private shares**: `is_private` flag on `shares`; hidden from search and public listing for non-owners
- **Custom slugs**: `handle/slug` format via `custom_slug` column with partial unique index
- **CLI tool** (`packages/cli/`): binary `share-html`; commands: `login`, `publish`, `update`, `delete`, `list`, `whoami`

### Database Migrations
- `20260424000001_add_editor_columns.sql`: `shares.source`, `shares.custom_slug`, `shares.is_private`, `shares.updated_at`
- `20260424000002_add_api_keys.sql`: `api_keys` table + RLS policies
- `20260424000003_private_search_filter.sql`: updates `search_shares` RPC to filter private shares by owner

### Changed
- `shares.source` column distinguishes `'upload'` from `'editor'` shares
- `search_shares` RPC updated to exclude private shares for non-owners

---

## [v1.0.0] — 2026-04-23

### Added
- **User authentication**: Google and GitHub OAuth via Supabase (PKCE flow)
- **`/auth/login`**: OAuth sign-in page with Google and GitHub buttons
- **`/auth/callback`**: PKCE code-exchange route; bootstraps `user_profiles` on first login
- **User dashboard** (`/dashboard`): share list with stats (count, total views, storage used)
- **Profile settings** (`/dashboard/profile`): edit display name and avatar URL
- **Favorites** (`/dashboard/favorites`): bookmark and browse saved shares
- **`BookmarkToggle`** component: add/remove favorites with optimistic update
- **`AuthUserMenu`** component: header dropdown with profile link and logout
- **`DashboardShareCard`** component: share card with stats and owner actions
- **`ProfileForm`** component: display name + avatar form with save feedback
- **Blue accent design system**: full UI overhaul with OKLCH color tokens in `app/globals.css`
- **50 MB upload limit**: increased from 10 MB (storage bucket, server API, client dropzone)
- **Markdown file support**: `.md` upload, react-markdown + remark-gfm + shiki viewer, preview/raw toggle
- **`MarkdownViewer`** + **`MarkdownViewerWrapper`** components (lazy-loaded via `next/dynamic`)
- **RLS hardening**: `user_profiles`, `favorites` tables with owner-only policies; `shares.user_id` ownership tracking
- **Middleware**: `utils/supabase/middleware.ts` for session refresh and `/dashboard/*` route protection

### Database Migrations
- `20260423000001_add_auth_tables.sql`: `user_profiles`, `favorites`, `shares.user_id`, `shares.title`

### Dependencies Added
- `@supabase/ssr` — SSR cookie-based session management
- `react-markdown` — Markdown parsing and rendering
- `remark-gfm` — GitHub Flavored Markdown support
- `shiki` — syntax highlighting with JS regex engine
- `next-themes` — class-based dark/light theme switching

---

## [2026-04-22] — Upload Size Increase & Markdown Support

### Added
- Markdown file upload (`.md` files)
- Client-side Markdown viewer with react-markdown + shiki
- Preview/raw toggle for Markdown shares
- GitHub-like prose styling (`app/markdown-viewer.css`)

### Changed
- Upload size limit: 10 MB → 50 MB (dropzone, API, Supabase bucket)
- Upload API: accepts `.md` extension and `text/markdown` MIME type
- `lib/extract-text.ts`: handles Markdown content for search indexing

---

## [2026-04-22] — Initial Platform Release

### Core Features
- HTML file upload with drag-and-drop
- Share link generation (nanoid 10-character slugs)
- Sandboxed HTML viewer with CSP headers
- Full-text search with pagination (TSVECTOR + GIN index)
- Light/dark theme switching
- Rate limiting (10 req/min per IP via Upstash Redis)
- 30-day automatic file expiration
- Delete token-based authorization
- Responsive design

### Tech Stack
- Next.js 16 with App Router, React 19, TypeScript 5
- Supabase (PostgreSQL + Storage)
- Tailwind CSS 4, shadcn/ui
- Vercel deployment
