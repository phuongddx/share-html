# DropItX - Project Roadmap

## Current Status Overview

DropItX has completed Phase 1 through Phase 4, delivering core file sharing, full-text search, user authentication, a Markdown editor, REST API with API key management, a CLI tool, a Share Access Security Layer, oEmbed + Rich Embed Widgets, Share Analytics Dashboard, and Team Workspaces. The project is now focused on production hardening and future enhancements.

### Current Phase: Production Hardening & Future Enhancements

**Progress**: Phase 1–4 complete  
**Key Focus**: Testing, monitoring, analytics, and next-wave features

## Project Timeline

### Phase 1: Core Functionality — COMPLETE
**Duration**: November 2024 – December 2024

- [x] HTML file upload with drag-and-drop
- [x] Share link generation (nanoid slugs)
- [x] Sandboxed HTML viewer with CSP headers
- [x] Basic error handling and validation
- [x] Supabase schema with RLS policies
- [x] File storage in Supabase Storage

### Phase 2: Enhanced Features — COMPLETE
**Duration**: January 2025 – February 2025

- [x] Full-text search with pagination (TSVECTOR + GIN + RPC)
- [x] Rate limiting via Upstash Redis (10 req/min)
- [x] Light/dark theme switching
- [x] File metadata tracking (size, type, views)
- [x] 30-day automatic expiration
- [x] Delete token-based authorization

### Phase 2.5: Upload & Format Enhancements — COMPLETE
**Duration**: April 2026

- [x] Upload size limit increased to 50 MB
- [x] Markdown (.md) file upload support
- [x] react-markdown + remark-gfm + shiki viewer
- [x] Preview/raw toggle for Markdown files
- [x] Lazy-loaded Markdown viewer (`next/dynamic`)

### Phase 3: Auth, Editor & API — COMPLETE
**Duration**: April 2026

#### Auth & Dashboard
- [x] Google/GitHub OAuth via Supabase (PKCE flow)
- [x] User dashboard: share history, stats (count, views, storage)
- [x] Profile settings: display name, avatar
- [x] Favorites/bookmark system
- [x] Header user menu (`AuthUserMenu`)
- [x] RLS hardening across all tables
- [x] Blue accent design system overhaul (OKLCH tokens)

#### Editor
- [x] Markdown editor (`/editor`) with CodeMirror 6
- [x] Live split-pane preview (react-markdown + shiki)
- [x] Editor slash commands + image drag-and-drop extensions
- [x] Auto-draft persistence to localStorage
- [x] Dirty-state unload warning
- [x] Publishing API: `POST /api/publish` (title, custom_slug, is_private)
- [x] Inline image upload: `POST /api/images/upload`

#### API & CLI
- [x] REST API v1: `POST/GET /api/v1/documents`, `GET/PATCH/DELETE /api/v1/documents/[slug]`
- [x] API key management: `POST/GET /api/v1/keys`, `DELETE /api/v1/keys/[id]`
- [x] `ApiKeyManager` dashboard component
- [x] `lib/api-auth.ts`: SHA-256 hash + `api_keys` lookup
- [x] Private shares (`is_private` flag) with RLS + search filter
- [x] CLI tool (`packages/cli/`): binary `share-html`
  - `login`, `publish`, `update`, `delete`, `list`, `whoami`

#### Migrations Delivered
- [x] `20260423000001_add_auth_tables.sql`
- [x] `20260424000001_add_editor_columns.sql`
- [x] `20260424000002_add_api_keys.sql`
- [x] `20260424000003_private_search_filter.sql`

### Phase 3.5: Share Access Security Layer — COMPLETE
**Duration**: April 2026

- [x] Password protection for shares (bcryptjs hash, never sent to client)
- [x] `PasswordGate` full-page password form for protected shares
- [x] `SharePasswordForm` reusable set/remove password UI
- [x] `POST /api/shares/[slug]/unlock` — verify password, issue HMAC-SHA256 signed access cookie (24 h, HttpOnly)
- [x] `POST /api/shares/[slug]/set-password` — owner/delete_token auth, set or remove password
- [x] View gate: owner bypass → is_private → access cookie → password gate → auth gate → login redirect
- [x] View count increments only after gate passes
- [x] Password rate limiting: 5 attempts / 10 min per IP, fail-closed on Redis error
- [x] Login redirect: `?next=/s/*` param with contextual "Sign in to view shared content" message
- [x] CLI `-P/--password` flag on `publish` command
- [x] API v1 `password` field on `POST /api/v1/documents` and `PATCH /api/v1/documents/[slug]`
- [x] Dashboard lock/unlock toggle on share cards

#### New Environment Variable
- `SHARE_ACCESS_SECRET` — 32+ char random string for HMAC cookie signing (required)

#### New Dependency
- `bcryptjs` — password hashing

#### Migrations Delivered
- [x] `20260425000001_add_share_password.sql`

### Phase 4: Growth, Engagement & Revenue — COMPLETE
**Duration**: April 2026

#### oEmbed + Rich Embed Widgets
- [x] `GET /api/oembed` endpoint for standardized content embedding
- [x] JSON and XML response formats for platform compatibility
- [x] Rich metadata generation (title, author, embed code)
- [x] Secure iframe embedding with CSP headers
- [x] Rate limiting and domain validation
- [x] WordPress/Medium embed compatibility

#### Share Analytics Dashboard
- [x] Real-time analytics collection system
- [x] `analytics_events` table for tracking user engagement
- [x] Page view, search, and upload event tracking
- [x] User behavior analytics (session duration, bounce rate)
- [x] Content performance metrics (popular shares, search terms)
- [x] API usage monitoring and error tracking
- [x] Geographic distribution analysis

#### Team Workspaces
- [x] Workspace creation and management system
- [x] `team_workspaces`, `workspace_members`, `workspace_shares` tables
- [x] Role-based access control (owner vs member)
- [x] Collaborative content sharing and organization
- [x] Invitation system for workspace members
- [x] Private workspace isolation with RLS policies
- [x] Workspace content discovery and management

### Phase 5: Production Hardening & Future Features — PLANNED
**Duration**: Q3 2026 onward

#### Production Hardening
- [ ] Comprehensive test suite (unit, integration, E2E)
- [ ] Security audit and penetration testing
- [ ] Performance benchmarking and optimization
- [ ] Production monitoring (error tracking, analytics, health checks)
- [ ] CI/CD pipeline with automated tests

#### Feature Backlog
- [ ] File organization and tagging
- [ ] Custom expiration dates
- [ ] Email notifications (upload confirmation, expiration reminder)
- [ ] Mobile applications
- [ ] Enterprise / multi-tenant features
- [ ] Advanced user permissions and roles
- [ ] Custom branding and white-label options

## Success Metrics

| Metric | Target |
|--------|--------|
| Uptime | > 99.9% |
| Page load time | < 2 seconds |
| API response time | < 500 ms |
| Upload success rate | > 99% |
| Error rate | < 1% |
| Test coverage | > 90% |
| Daily active users | 1,000 |
| Uploads per day | 500 |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Database query performance at scale | GIN index + RPC optimization; query analysis |
| Storage cost growth | Expiration cleanup; storage usage monitoring |
| XSS in HTML rendering | CSP headers; sandboxed iframe |
| API key compromise | Hashes only stored; instant soft-revocation |
| Password brute-force on shares | Rate limiting (5/10 min); bcryptjs cost factor; fail-closed on Redis error |
| Cookie forgery on password-gated shares | HMAC-SHA256 with 32+ char secret; HttpOnly; 24 h expiry |
| Slow user adoption | Unique CLI + API value proposition; developer-focused features |
