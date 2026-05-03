# DropItX - Project Overview & PDR

## Project Vision

DropItX is a modern web platform that enables users to upload HTML and Markdown files, write content in a built-in Markdown editor, and generate shareable links for easy content distribution. Features include team workspaces, analytics dashboard, password-protected shares, rich embedding via oEmbed, and programmatic access via REST API and CLI tool.

## Target Users

### Primary Users
- **Web Developers**: Share code snippets, demos, prototypes, and publish via CLI
- **Designers**: Share mockups and design concepts via HTML
- **Content Creators**: Distribute articles, tutorials, and guides via Markdown
- **Teams**: Collaborate on web projects by sharing HTML/Markdown builds

### Secondary Users
- **Project Stakeholders**: Review progress via shared HTML builds
- **Clients**: Preview websites without deployment requirements
- **Educators**: Share teaching materials and student examples

## Core Features

### File Sharing
- **File Upload**: Drag-and-drop HTML and Markdown file upload (up to 50 MB)
- **Link Generation**: Automatic short, shareable URLs (10-character slugs)
- **HTML Viewer**: Secure sandboxed iframe rendering with CSP headers
- **Markdown Viewer**: GitHub-like prose rendering with shiki syntax highlighting

### Authoring
- **Markdown Editor**: Split-pane live preview editor powered by CodeMirror 6
- **Editor Publish**: Publish directly from editor with title, custom slug, and privacy flag
- **Image Upload**: Inline image drag-and-drop in the editor (PNG/JPG/GIF/WebP, max 5 MB)
- **Auto-Draft**: Client-side draft persistence with dirty-state unload warning

### Search & Discovery
- **Search**: Full-text search via Postgres TSVECTOR + GIN index
- **Favorites**: Authenticated users can bookmark shares

### Developer Access
- **REST API**: Bearer API key authentication for programmatic document management
- **API Key Management**: Dashboard UI for generating and revoking API keys
- **CLI Tool**: `dropitx` binary for publish/update/delete/list from the terminal

### Platform
- **User Auth**: Google, GitHub OAuth, and email/password via Supabase (PKCE flow)
- **Dashboard**: Share history, stats (count, total views, storage used)
- **Analytics Dashboard**: Real-time analytics with charts and metrics
- **Team Workspaces**: Collaborative content sharing and management
- **Team Invite System**: Enhanced invite form with role selection and email validation, bulk invite, resend functionality, invite accept flow
- **Team RPC Client**: Type-safe server communication for team operations
- **Token Security**: Utilities for invite token management and security
- **Profile**: Edit display name and avatar
- **Theme Support**: Light/dark mode switching
- **Rate Limiting**: 10 requests/minute to prevent abuse

## Technical Requirements

### Functional Requirements
1. **File Upload**: Accept `.html`, `.htm`, `.md` files up to 50 MB
2. **Editor Publish**: Create shares from Markdown content with title, custom slug, `is_private` flag
3. **Link Generation**: Create unique readable slugs using nanoid
4. **HTML Rendering**: Display content in sandboxed iframe with CSP
5. **Markdown Rendering**: Render Markdown with GFM + syntax highlighting
6. **Image Upload**: Accept PNG/JPG/GIF/WebP up to 5 MB; return public URL for inline use
7. **Search**: Full-text search with pagination (10 results per page)
8. **Metadata**: Track filename, file size, MIME type, view count, source
9. **Expiration**: Automatic deletion after 30 days
10. **Security**: Token-based deletion, RLS, API key auth (SHA-256 hash stored)
11. **Privacy**: `is_private` shares hidden from search and public listing for non-owners
12. **API Keys**: Generate, list, revoke API keys; only SHA-256 hash persisted

### Non-Functional Requirements
- **Performance**: Fast load times, editor renders without SSR
- **Security**: Input validation, RLS policies, CSP headers, API key hashing, token security for invites
- **Reliability**: High availability, compensating transactions on upload failure
- **Scalability**: Handle thousands of concurrent uploads
- **Maintainability**: Clean code structure, monorepo with shared types, modular UI primitives
- **Team Collaboration**: Secure invite system with role-based access control and bulk operations

## Acceptance Criteria

### Upload Functionality
- [ ] Users can drag and drop HTML/Markdown files onto the upload area
- [ ] File size validation (max 50 MB)
- [ ] File type validation (`.html`, `.htm`, `.md`)
- [ ] Progress feedback during upload
- [ ] Success notification with generated share link
- [ ] Error messages for invalid files or size limits

### Editor & Publish
- [ ] CodeMirror editor with split-pane live preview
- [ ] Publish creates a share with optional title, custom slug, `is_private` flag
- [ ] Auto-draft persists to localStorage on change
- [ ] Dirty-state warning on page unload
- [ ] Image drag-and-drop into editor inserts Markdown image syntax

### Share Link Generation
- [ ] Each upload/publish generates a unique URL slug
- [ ] Links follow format: `https://app.domain/s/{slug}`
- [ ] Custom slugs follow `handle/slug` format
- [ ] Delete tokens generated for file-upload shares
- [ ] Links work immediately after creation

### API Key Auth
- [ ] Authenticated users can create named API keys from dashboard
- [ ] Key displayed once at creation; only SHA-256 hash stored
- [ ] Bearer token requests authenticated via `lib/api-auth.ts`
- [ ] `revoked_at` soft-delete preserves audit history
- [ ] `last_used_at` updated asynchronously on each auth

### Privacy
- [ ] `is_private` shares excluded from search results for non-owners
- [ ] `is_private` shares return 403 on `/s/[slug]` for non-owners

### Security & Reliability
- [ ] All write endpoints protected by rate limiting
- [ ] RLS on all database tables
- [ ] Compensating transaction: delete storage if DB insert fails
- [ ] API key hashing with Node `crypto` (no external service)

## Technical Constraints

### Technology Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript strict — pure frontend on Vercel
- **Backend**: FastAPI (Python) on Render — all API logic
- **Editor**: CodeMirror 6, loaded via `next/dynamic` (ssr: false)
- **Database**: Supabase (PostgreSQL + Storage)
- **Styling**: Tailwind CSS 4, shadcn/ui, OKLCH color tokens
- **Cache/Rate-limit**: Upstash Redis
- **CLI**: `packages/cli/` — TypeScript ESM, binary `dropitx`
- **Analytics**: Vercel Analytics + custom `analytics_events` table

### Infrastructure Constraints
- Deploy on Vercel platform
- Use Supabase for backend services
- Rate limiting via Upstash Redis
- API key hashing via Node.js built-in `crypto` (no new env vars)

### Security Constraints
- Row Level Security (RLS) on all database tables
- Content Security Policy for HTML rendering
- API key: only SHA-256 hash stored, prefix stored for display
- Input validation on all user inputs

## Project Milestones

### Phase 1: Core Functionality (Complete)
- [x] HTML file upload interface
- [x] Share link generation and viewing
- [x] Database schema and Supabase integration
- [x] Basic error handling and validation

### Phase 2: Enhanced Features (Complete)
- [x] Full-text search with pagination
- [x] Rate limiting and abuse prevention
- [x] Theme switching (light/dark mode)
- [x] Responsive design optimization
- [x] Markdown file upload and viewer
- [x] 50 MB upload limit

### Phase 3: Auth, Editor & API (Complete)
- [x] User authentication (Google/GitHub OAuth + email/password)
- [x] User dashboard with share history and stats
- [x] Profile settings and avatar management
- [x] Favorites/bookmark system
- [x] Markdown editor (CodeMirror) with live split-pane preview
- [x] Publishing API (`POST /api/publish`)
- [x] API key management (create, list, revoke)
- [x] REST API v1 for programmatic document management
- [x] Inline image upload for editor
- [x] CLI tool (`packages/cli/`) with `share-html` binary
- [x] Private shares (`is_private` flag)
- [x] RLS hardening

### Phase 4: Team Workspaces, Analytics & Embed (Complete)
- [x] Analytics dashboard with real-time charts and metrics
- [x] Team workspaces with role-based access control
- [x] Collaborative content sharing and management
- [x] oEmbed support for rich content embedding
- [x] Password protection for shares
- [x] Vercel Analytics integration

### Phase 5: Production Hardening (In Progress)
- [x] Enhanced team invite system with role selection and email validation
- [x] Enhanced invite dialog with invite link generation and team RPC client
- [x] Bulk invite dialog supporting multiple email addresses
- [x] Invite accept flow with team join functionality
- [x] Team RPC client for type-safe server calls
- [x] Token security utilities for invite token management
- [x] New UI primitives: dialog, select, textarea, alert components
- [x] New hooks: use-email-validation, use-team, use-toast
- [ ] Comprehensive test suite (unit, integration, E2E)
- [ ] Security audit and penetration testing
- [ ] Performance benchmarking and optimization
- [ ] Production monitoring and error tracking
- [ ] CI/CD pipeline with automated tests

## Success Metrics

| Category | Metric | Target |
|----------|--------|--------|
| Performance | Page load time | < 2 seconds |
| Performance | Search response | < 500 ms |
| Reliability | Upload success rate | > 99% |
| Reliability | Error rate | < 1% |
| Engagement | Daily active users | 1,000 |
| Engagement | Uploads per day | 500 |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Upstash availability | Monitor service health; graceful degradation allows requests through |
| Storage cost growth | Storage usage monitoring; expiration cleanup |
| XSS in HTML rendering | Rigorous CSP policy; sandboxed iframe |
| API key compromise | Hashes only stored; instant revocation via `revoked_at` |
| Abuse / spam | Rate limiting; content moderation roadmap |
