# Project Changelog

All notable changes to DropItX.

## [v1.3.2] — 2026-04-26

### Added
- **HeaderBar compound component system**:
  - `HeaderBar`: Main orchestrator managing responsive state and mobile drawer
  - `HeaderNav`: Desktop navigation with menu toggle functionality
  - `HeaderMobileDrawer`: Slide-out mobile navigation with backdrop and close functionality
- **Navigation utilities**: `lib/nav-links.ts` (centralized links), `lib/use-auth-user.ts` (auth state hook)
- **Layout optimization**: Removed duplicate logo and profile from dashboard sidebar

### Changed
- **Header standardization**: Replaced inline header in `app/layout.tsx` with `HeaderBar` compound component
- **Dashboard layout**: Simplified sidebar by moving logo and profile to header component

### Components Architecture
New compound pattern improves:
- **Reusability**: Single header across all layouts
- **Maintainability**: Centralized header logic and styling
- **Responsive design**: Proper mobile/desktop state management
- **Performance**: Reduced component duplication

---

## [v1.3.1] — 2026-04-25

---

## [v1.3.1] — 2026-04-25

### Changed
- **Typography**: Replaced Geist Sans + Geist Mono with Ubuntu + Ubuntu Mono across all pages, markdown viewer, and code blocks

---

## [v1.3.0] — 2026-04-25

### Changed
- **Rebrand**: ShareHTML → DropItX with electric violet identity (OKLCH color tokens, updated all UI components)

---

## [v1.2.0] — 2026-04-25

### Added
- **Password protection for shares**: bcryptjs hash stored in `shares.password_hash`; `has_password: boolean` flag exposed to clients (raw hash never sent)
- **`PasswordGate` component**: full-page password entry form rendered when a share is password-protected
- **`SharePasswordForm` component**: reusable set/remove password form used in dashboard share cards
- **`POST /api/shares/[slug]/unlock`**: verifies password and issues an HMAC-SHA256 signed HttpOnly access cookie (24 h TTL)
- **`POST /api/shares/[slug]/set-password`**: owner or delete_token auth; sets or clears `password_hash`
- **`lib/password.ts`**: bcryptjs `hashPassword` / `verifyPassword` helpers
- **`lib/share-access-cookie.ts`**: HMAC-SHA256 cookie signing/verification using `SHARE_ACCESS_SECRET`
- **`checkPasswordRateLimit`** in `lib/rate-limit.ts`: 5 attempts / 10 min per IP sliding window; fail-closed (503) when Redis is unavailable
- **View gate on `/s/[slug]`**: layered access control — owner bypass → is_private → access cookie → password gate → auth gate → login redirect; view count increments only after gate passes
- **Login redirect**: `app/auth/login/page.tsx` reads `?next=` param (validated as `/s/*`), passes through OAuth callback, shows "Sign in to view shared content" contextual message
- **Dashboard lock/unlock toggle**: share cards show password lock state with set/remove controls via `SharePasswordForm`
- **Password section in `ShareLink`**: anonymous upload flow can optionally set a password on the share
- **CLI `-P/--password` flag**: `share-html publish <file> -P <password>` sets password on publish
- **API v1 `password` field**: `POST /api/v1/documents` and `PATCH /api/v1/documents/[slug]` accept optional `password` field

### Database Migrations
- `20260425000001_add_share_password.sql`: `shares.password_hash` (nullable TEXT)

### New Environment Variable
- `SHARE_ACCESS_SECRET` — 32+ char random string for HMAC cookie signing (required for password-gated shares)

### New Dependencies
- `bcryptjs` — password hashing

### Security Model
- All `/s/[slug]` views require login OR valid password cookie. Owner always bypasses gate.
- `password_hash` is never returned to the client; API exposes `has_password: boolean` only.
- Rate limiting is fail-closed: if Redis is unavailable, password unlock returns 503 (no silent bypass).

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
