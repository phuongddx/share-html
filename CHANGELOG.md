# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.1] - 2026-04-26

### Added

- HeaderBar compound component system:
  - HeaderBar orchestrator with responsive state management
  - HeaderNav desktop navigation with menu toggle
  - HeaderMobileDrawer slide-out menu with backdrop
- Navigation links configuration utility (`nav-links.ts`)
- Authentication user hook (`use-auth-user.ts`)
- Updated main layout to use HeaderBar component
- Optimized dashboard sidebar by removing duplicate logo and profile elements

### Changed

- Replaced inline header in app/layout.tsx with HeaderBar compound component
- Simplified dashboard sidebar layout by moving logo and profile to header

## [1.3.0] - 2026-04-25

### Changed

- Rebranded from ShareHTML to DropItX with electric violet identity
- CSS design tokens: blue accent (hue 264) → violet (hue 293); neutral backgrounds shifted to violet-tinted hue 280
- Logotype updated to `[x] dropitx` in Geist Mono with violet accent across all layouts
- Home page hero heading, tagline, gradient orb, and footer copy updated
- All hardcoded `blue-*` Tailwind classes replaced with `violet-*` equivalents across components
- HTML and MD file-type icons unified to `text-violet-500`
- CLI binary renamed `share-html` → `dropitx`; config dir `~/.share-html` → `~/.dropitx` (auto-migrated on first run)
- Package name updated to `dropitx`
- Docs and README updated with new brand and CLI references

## [1.2.0] - 2026-04-25

### Added

- `-P`/`--password` flag on CLI `publish` command for password-protected shares

### Changed

- Rate limiting migrated from Upstash Redis to Supabase Postgres

### Security

- Share views gated behind login or password for private/password-protected content

## [1.1.0] - 2026-04-24

### Added

- In-browser Markdown editor with split-pane live preview (CodeMirror 6)
- Scroll synchronization between editor and preview panes
- Slash commands in editor (`/image`, `/heading`, `/code`, etc.)
- Image drag-and-drop directly into editor with inline preview
- Editor auto-save (draft persistence in localStorage)
- Unload warning when unsaved changes are present
- Publish from editor with title, custom slug, and privacy toggle
- `POST /api/publish` — editor publish endpoint (session auth, rate-limited)
- `POST /api/images/upload` — inline image upload (PNG/JPG/GIF/WebP, max 5 MB, auth required)
- REST API v1 for programmatic document management:
  - `POST /api/v1/documents` — create document from Markdown content
  - `GET /api/v1/documents` — list own documents (paginated)
  - `GET /api/v1/documents/[slug]` — get document metadata
  - `PATCH /api/v1/documents/[slug]` — update content/metadata
  - `DELETE /api/v1/documents/[slug]` — delete document
- API key management (`GET/POST /api/v1/keys`, `DELETE /api/v1/keys/[id]`)
- API key UI in dashboard (`ApiKeyManager` component)
- CLI tool (`share-html`) for publishing Markdown from the terminal:
  - `login`, `publish`, `update`, `delete`, `list`, `whoami` commands
- Private shares (`is_private` flag) — hidden from search, owner-only access
- Custom slug support (`handle/slug` format)
- Supabase migrations: editor columns, API keys table, private search filter

### Changed

- Shares table extended with `title`, `custom_slug`, `is_private`, `source`, `updated_at`
- Image upload allowed MIME types expanded (`image/png`, `image/jpeg`, `image/gif`, `image/webp`)
- Storage bucket updated: 50 MB limit (aligned with upload limit)

### Security

- API keys stored as SHA-256 hashes only — plaintext never persisted
- Soft revocation (`revoked_at`) preserves audit history
- `is_private` enforced via Row Level Security (`NOT is_private OR user_id = auth.uid()`)
- API key authentication requires cookie-auth session to bootstrap (prevents key-loop abuse)

## [1.0.0] - 2026-04-23

### Added

- HTML file upload with drag-and-drop interface
- Short slug-based share links (`/s/abc123`)
- Sandboxed HTML content viewer with CSP headers
- Markdown (.md) file upload support with GitHub-like rendered preview
- Shiki syntax highlighting for markdown code blocks (10 languages)
- Preview/raw toggle for markdown files
- Full-text search across uploaded content with pagination
- Rate limiting via Upstash Redis (10 req/min)
- Light/dark theme switching
- 30-day automatic share expiration
- Delete token-based authorization
- User authentication with Google and GitHub OAuth (Supabase Auth)
- User dashboard with share history
- Profile settings management
- Favorites/bookmark system
- Header user menu with auth integration

### Changed

- Migrated to Supabase SSR v3 with cookie-based sessions
- Increased upload size limit from 10MB to 50MB
- Full UI overhaul with blue accent design system

### Fixed

- Storage uploads now use admin client to bypass RLS
- Corrected markdown text extraction for search indexing
- Removed MIME type validation for broader browser support
- Used Uint8Array for storage upload body and improved error logging
- Hardened RLS policies and security definer trigger

### Security

- Sandboxed iframe viewing with Content Security Policy
- Row Level Security policies on all database tables
- Rate limiting on upload and search endpoints
- Server-side input validation and sanitization

### Tech Stack

- Next.js 16 (App Router, React 19)
- Supabase (PostgreSQL, Storage, Auth, SSR cookie sessions)
- Tailwind CSS 4 + shadcn/ui
- Upstash Redis (rate limiting)
- TypeScript 5

[Unreleased]: https://github.com/phuongddx/dropitx/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/phuongddx/dropitx/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/phuongddx/dropitx/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/phuongddx/dropitx/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/phuongddx/dropitx/releases/tag/v1.0.0
