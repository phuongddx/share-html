# Codebase Summary

## Overview

DropItX is a Next.js 16 (App Router) application for uploading HTML/Markdown files, writing in a built-in Markdown editor, and generating short shareable links. Features include team workspaces, analytics dashboard, password-protected shares, rich embedding via oEmbed, and programmatic access via REST API and CLI. Deployed on Vercel with Supabase (PostgreSQL + Storage) and Upstash Redis.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Editor | CodeMirror 6, loaded via `next/dynamic` (ssr: false) |
| Viewer | `react-markdown` + `remark-gfm` + shiki |
| Database | Supabase PostgreSQL (RLS), Storage (S3-compatible) |
| Auth | Supabase Auth (Google + GitHub OAuth + email/password, PKCE), `@supabase/ssr` |
| Styling | Tailwind CSS 4, shadcn/ui, OKLCH color tokens |
| Rate limiting | Upstash Redis |
| File upload | `react-dropzone` |
| Theming | `next-themes` |
| Analytics | Vercel Analytics + custom `analytics_events` table |
| CLI | `packages/cli/` — TypeScript ESM, binary `dropitx` |

## Recent Major Changes

### v2.3.0 (2026-05-02) - FastAPI Migration
- **All Next.js API routes removed**: 24 route handlers (~2,400 lines) deleted
- **Frontend is now pure client**: Calls FastAPI backend via `authFetch()` with JWT Bearer auth
- **`lib/api-client.ts`**: Singleton Supabase client + JWT injection + 401 retry
- **Only remaining route**: `app/api/og-image/route.ts`
- **Removed lib files**: `api-auth.ts`, `rate-limit.ts`, `validate-editor-content.ts`, `extract-text.ts`, `extract-title-from-markdown.ts`
- **New env var**: `NEXT_PUBLIC_API_URL=https://dropitx-api.onrender.com`

### v2.2.0-v2.2.1 (2026-04-29) - Team Invite Enhancement
- Enhanced invite form, bulk invite, accept/decline flow
- Invite notification bell with auto-refresh
- Team RPC client + token security utilities
- Auto-signup accept flow for unauthenticated users

## File Structure Overview

```
app/
├── layout.tsx, page.tsx, globals.css, not-found.tsx, error.tsx
├── editor/page.tsx                     # Markdown editor (SSR-disabled)
├── s/[slug]/page.tsx                   # Public share viewer
├── embed/[slug]/page.tsx              # oEmbed viewer
├── search/page.tsx                     # Full-text search
├── invite/accept/page.tsx             # Team invite acceptance
├── dashboard/
│   ├── layout.tsx, page.tsx            # Share list + stats + API keys
│   ├── profile/page.tsx
│   ├── favorites/page.tsx
│   ├── analytics/page.tsx, analytics/[slug]/page.tsx
│   ├── teams/page.tsx, teams/new/page.tsx
│   └── teams/[slug]/(page,members,settings).tsx
├── auth/
│   ├── login/page.tsx                 # Email/password + OAuth
│   ├── callback/route.ts              # PKCE code exchange
│   ├── confirm/route.ts               # Email confirmation
│   ├── reset-password/page.tsx
│   └── update-password/page.tsx
└── api/
    └── og-image/route.ts              # Only remaining Next.js API route

components/
├── ui/{button,card,input,textarea,dialog,select,badge,alert,sonner,skeleton,popover}.tsx
├── editor-shell.tsx, editor-pane.tsx, editor-preview.tsx
├── editor-toolbar.tsx, editor-publish-bar.tsx
├── upload-dropzone.tsx, share-link.tsx, copy-button.tsx
├── search-bar.tsx, search-results.tsx
├── html-viewer.tsx, markdown-viewer.tsx, markdown-viewer-wrapper.tsx
├── dashboard-share-card.tsx, dashboard-share-list.tsx, bookmark-toggle.tsx
├── api-key-manager.tsx, profile-form.tsx
├── auth-user-menu.tsx, home-page.tsx, theme-provider.tsx, vercel-analytics.tsx
├── header-bar.tsx, header-nav.tsx, header-mobile-drawer.tsx
├── password-gate.tsx, share-password-form.tsx
├── share-viewed-tracker.tsx, share-analytics-tracker.tsx
├── embed-viewed-tracker.tsx, embed-snippet.tsx
├── analytics/{stats-cards,view-chart,geo-chart,referrer-chart,top-performers,empty-state}.tsx
├── create-team-form.tsx, team-member-row.tsx, team-nav.tsx, team-share-card.tsx
├── invite-member-dialog.tsx, enhanced-invite-dialog.tsx, bulk-invite-dialog.tsx
├── invite-notification-bell.tsx, invite-status-card.tsx, invite-accept-form.tsx
├── members-page-client.tsx, team-activity-feed.tsx
└── team/team-invite-form.tsx

lib/
├── api-client.ts                      # authFetch() with JWT Bearer + 401 retry
├── api-key.ts                         # API key utilities
├── api-utils.ts                       # API helper functions
├── utils.ts, nanoid.ts
├── password.ts                        # Password hashing helpers
├── share-access-cookie.ts             # Password access cookie management
├── team-utils.ts, team-rpc.ts, team-event-utils.ts
├── token-security.ts, invite-utils.ts
├── analytics-track.ts, analytics.ts
├── oembed-utils.ts, referrer-parser.ts
├── shiki-highlighter.ts, slugify-handle.ts
├── nav-links.ts, validation.ts, validate-custom-slug.ts
├── use-auth-user.ts, use-editor-auto-save.ts, use-scroll-sync.ts
└── editor-extensions.ts, editor-extensions/(image-drop, image-preview, slash-commands)

utils/supabase/
├── client.ts, server.ts, middleware.ts

types/
└── share.ts, team.ts, team-event.ts, analytics.ts

packages/cli/
├── package.json, tsconfig.json
└── src/
    ├── index.ts                       # CLI entry (binary: dropitx)
    └── commands/login,publish,update,delete,list,whoami

supabase/
├── schema.sql, config.toml
└── migrations/
    ├── 20260423000001_add_auth_tables.sql
    ├── 20260424000001_add_editor_columns.sql
    ├── 20260424000002_add_api_keys.sql
    ├── 20260424000003_private_search_filter.sql
    ├── 20260425000001_add_share_password.sql
    ├── 20260425045621_rate-limits-supabase.sql
    ├── 20260426000001_share_views.sql
    ├── 20260426000002_teams.sql
    ├── 20260428000001_fix_team_owner_trigger_rls.sql
    ├── 20260428000002_fix_team_members_rls_recursion.sql
    ├── 20260428000003_fix_teams_insert_policy.sql
    ├── 20260428000004_fix_rls_policies_use_anon_role.sql
    ├── 20260428000005_fix_stable_to_volatile_rls_functions.sql
    ├── 20260428162629_fix_rls_policies_to_authenticated.sql
    ├── 20260429_team_lifecycle_redesign.sql
    ├── 20260429180000_decline_team_invite.sql
    └── 20260430121500_fix_ambiguous_team_id_in_invite_policies.sql
```

## Key Architectural Patterns

### Client-Server Architecture (v2.3.0)
- **Next.js (Vercel)**: Pure frontend — no API routes (except OG image)
- **FastAPI (Render)**: All API logic — uploads, shares, auth, teams, analytics
- **Communication**: `authFetch()` from `lib/api-client.ts` injects JWT Bearer token
- **Auth**: Supabase JWT sent as Bearer token to FastAPI; FastAPI validates via JWKS

### Dual Authentication Model
- **JWT Session**: Browser users with OAuth/email auth via Supabase → JWT sent to FastAPI
- **API Key**: Programmatic access with SHA-256 hash lookup (FastAPI-side)

### Team Invite System Architecture
- **Single Invite**: Role-based invite with email validation and server-side verification
- **Bulk Invite**: Batch processing with progress tracking and error handling
- **Invite Resend**: Secure token-based resend functionality with rate limiting
- **Accept Flow**: Secure token-based acceptance with automatic team membership
- **RPC Client**: Type-safe server communication for team operations
- **Token Security**: Secure invite token generation, validation, and management

### Component Architecture
- **UI Primitives**: Reusable components in `components/ui/` using shadcn/ui patterns
- **Feature Components**: Organized by domain (auth, team, editor, share, analytics)
- **Compound Components**: Header system with `HeaderBar`, `HeaderNav`, `HeaderMobileDrawer`
- **Hooks**: Custom hooks for state management, validation, and side effects

### Database Architecture
- **8 Core Tables**: `shares`, `user_profiles`, `favorites`, `api_keys`, `team_workspaces`, `workspace_members`, `workspace_shares`, `analytics_events`
- **RLS Policies**: Row-level security for data access control
- **RPC Functions**: `search_shares`, `increment_view_count`, `get_user_workspaces`, etc.
- **Event Sourcing**: Team lifecycle tracking with `team_events` table

### Security Patterns
- **Input Validation**: Client and server-side validation with comprehensive error handling
- **Rate Limiting**: Upstash Redis sliding window (10 req/min, 5 attempts/10 min for passwords)
- **Password Protection**: bcryptjs hash with HMAC-SHA256 access cookies
- **API Key Security**: SHA-256 hash storage with soft-revocation via `revoked_at`
- **CSRF Protection**: Next.js middleware with Supabase auth integration
- **Content Security**: CSP headers for HTML rendering, sandboxed iframes

### Performance Patterns
- **CodeMirror SSR Guard**: Editor loaded via `next/dynamic { ssr: false }`
- **Auto-Draft**: `useEditorAutoSave` persists to localStorage with dirty-state warning
- **Image Optimization**: Next.js Image component with optimized loading
- **Search Optimization**: Postgres TSVECTOR + GIN index with ranking
- **Lazy Loading**: Dynamic imports for heavy components (MarkdownViewer, analytics charts)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `SHARE_ACCESS_SECRET` | 32+ char secret for HMAC cookie signing (password protection) |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL (e.g. `https://dropitx-api.onrender.com`) |

## Development Commands

```bash
npm run dev     # Development server
npm run build   # Production build + TypeScript check
npm run lint    # ESLint

# CLI:
cd packages/cli && npm run build && npm link
dropitx login
dropitx publish README.md -t "My Doc"
```

## Recent Development Status

### v2.3.0 (2026-05-02) - FastAPI Migration
- ✅ All 24 Next.js API routes removed, frontend is pure client
- ✅ `lib/api-client.ts` with `authFetch()` + JWT Bearer + 401 retry
- ✅ 17 client components migrated to use `authFetch()`
- ✅ Only OG image route remains in Next.js

### v2.2.1 (2026-04-29) - Invite Accept UI
- ✅ Invite notification bell with auto-refresh
- ✅ Decline team invite RPC + API route
- ✅ Auto-signup accept flow for unauthenticated users

### v2.2.0 (2026-04-29) - Team Invite Enhancement
- ✅ Enhanced team invite system with role selection and email validation
- ✅ Enhanced invite dialog with invite link generation and team RPC client
- ✅ Bulk invite dialog supporting multiple email addresses
- ✅ Invite accept flow with team join functionality
- ✅ Team RPC client for type-safe server calls
- ✅ Token security utilities for invite token management
- ✅ New UI primitives: dialog, select, textarea, alert components
- ✅ New hooks: use-email-validation, use-team, use-toast

### v2.1.0 (2026-04-29) - Email Authentication
- ✅ Email/password authentication system with PKCE flow
- ✅ Email confirmation and verification pages
- ✅ Complete password reset flow
- ✅ Split-screen login page redesign

### v2.0.1 (2026-04-28) - Team RLS Hardening
- ✅ RLS policy hardening for team workspaces
- ✅ Fixed infinite recursion and permission errors
- ✅ Authentication role migration from anon to authenticated

### v2.0.0 (2026-04-26) - Team Workspaces & Analytics
- ✅ Team workspaces with role-based access control
- ✅ Analytics dashboard with real-time charts and metrics
- ✅ oEmbed support for rich content embedding
- ✅ Password protection for shares

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                          Browser                             │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────┐  │
│  │ Upload   │ │ View /s/ │ │/search │ │ /editor          │  │
│  │ Dropzone │ │ Iframe   │ │Results │ │ EditorShell      │  │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └────────┬─────────┘  │
└───────┼─────────────┼───────────┼───────────────┼────────────┘
        │             │           │               │
        ▼             ▼           ▼               ▼
┌──────────────────────────────────────────────────────────────┐
│                     Next.js (Vercel)                         │
│  Pure frontend — no API routes (except /api/og-image)        │
│  Client components use authFetch() / fetch(getApiUrl())      │
│  lib/api-client.ts: singleton Supabase client + 401 retry   │
└──────────────────────────┬───────────────────────────────────┘
                           │  JWT Bearer token
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Render)                     │
│  dropitx-api.onrender.com                                    │
│                                                              │
│  POST /api/upload     GET /api/search    POST /api/publish   │
│  POST /api/images/upload                                   │
│  GET/PATCH/DELETE /api/shares/{slug}                        │
│  POST /api/shares/{slug}/unlock                              │
│  POST /api/shares/{slug}/set-password                        │
│  POST /api/analytics/track   GET /api/oembed                 │
│  GET|POST /api/v1/keys    DELETE /api/v1/keys/{key_id}      │
│  POST /api/v1/documents  GET /api/v1/documents              │
│  CRUD /api/dashboard/teams, /api/dashboard/teams/{slug}/*   │
│  POST /api/invite/accept   POST /api/invite/decline          │
│                                                              │
│  JWT validation via JWKS  ·  Rate limiting via Upstash       │
└───────────┬──────────────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────┐  ┌──────────────────────┐
│  Supabase         │  │  Upstash Redis       │
│  PostgreSQL (RLS) │  │  Rate Limiting       │
│  Storage (S3)     │  │  (10 req/min/IP)     │
└───────────────────┘  └──────────────────────┘

CLI (packages/cli/)
────────────────────
dropitx publish <file> [-P password]  →  POST /api/v1/documents
dropitx list                          →  GET  /api/v1/documents
dropitx delete <slug>                 →  DELETE /api/v1/documents/[slug]
Config: ~/.dropitx/config.json (mode 0600)
```

## Key Design Principles

- **Simplicity**: Minimal UI focused on core functionality
- **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation
- **Consistency**: Uniform component patterns and design tokens
- **Performance**: Optimized loading and rendering patterns
- **Security**: Multiple layers of input validation and access control
- **Maintainability**: Modular architecture with clear separation of concerns

## Migration Strategy

All schema changes are managed via timestamped SQL migrations in `supabase/migrations/`. Apply with:
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

The 16 migrations cover auth, editor, API keys, password protection, rate limiting, analytics, teams, RLS fixes, and enhanced invite system.