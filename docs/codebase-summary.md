# Codebase Summary

## Overview

DropItX is a Turborepo monorepo with Next.js 16 web application and Hono API server for uploading HTML/Markdown files, writing in a built-in Markdown editor, and generating short shareable links. Features include team workspaces, analytics dashboard, password-protected shares, rich embedding via oEmbed, and programmatic access via REST API and CLI. Deployed on Vercel with Supabase (PostgreSQL + Storage) and Upstash Redis.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo, pnpm workspace |
| Web Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| API Framework | Hono, Hono Zod Validator |
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

## Recent Major Features (v2.2.0 - 2026-04-29)

### Enhanced Team Invite System
- **Team Invite Form**: Enhanced form with role selection and email validation
- **Enhanced Invite Dialog**: Advanced dialog with invite link generation and team RPC client integration
- **Bulk Invite Dialog**: Support for inviting multiple team members at once with progress tracking
- **Invite Accept Flow**: Complete flow from invite acceptance to team membership
- **Team RPC Client**: Type-safe server communication for team operations using `lib/team-rpc.ts`
- **Token Security Utilities**: Secure invite token management with `lib/token-security.ts`

### New UI Components
- **Dialog**: Modal dialog component for user interactions
- **Select**: Dropdown select component for single/multiple selections
- **Textarea**: Multi-line input component with consistent styling
- **Alert**: Contextual alert component with different severity levels
- **Skeleton**: Loading state component matching final layout
- **CopyButton**: Copy-to-clipboard component for share links

### New Hooks
- **use-email-validation**: Real-time email validation hook
- **use-team**: Team workspace state management hook
- **use-toast**: Toast notification hook

### New API Routes
- `POST /api/dashboard/teams/[slug]/invites/bulk` - Bulk invite multiple users
- `POST /api/dashboard/teams/[slug]/invites/[id]/resend` - Resend invite to user

## File Structure Overview

```
packages/
├── shared/                             # Shared utilities and types
│   └── src/
│       ├── supabase/                   # Supabase client configurations
│       └── types/                      # Shared TypeScript types
├── web/                                # Next.js web application
│   └── app/
│       ├── layout.tsx, page.tsx, globals.css, not-found.tsx, error.tsx
│       ├── editor/page.tsx                     # Markdown editor (SSR-disabled)
│       ├── s/[slug]/page.tsx, loading.tsx      # Public share viewer
│       ├── embed/[slug]/page.tsx               # Embed-friendly viewer
│       ├── search/page.tsx, loading.tsx        # Full-text search
│       ├── dashboard/
│       │   ├── layout.tsx, page.tsx            # Share list + stats + API keys
│       │   ├── profile/page.tsx
│       │   ├── favorites/page.tsx
│       │   ├── analytics/page.tsx              # Analytics dashboard with charts
│       │   ├── teams/page.tsx                  # Team workspace list
│       │   ├── teams/new/page.tsx             # Create new workspace
│       │   ├── teams/[slug]/page.tsx           # Workspace details
│       │   ├── teams/[slug]/members/page.tsx  # Member management
│       │   ├── teams/[slug]/settings/page.tsx # Workspace settings
│       │   └── teams/[slug]/shares/page.tsx   # Workspace content
│       ├── auth/
│       │   ├── login/page.tsx                 # Email/password + OAuth sign-in
│       │   ├── callback/route.ts              # PKCE code exchange
│       │   ├── confirm/route.ts               # Email confirmation
│       │   ├── reset-password/page.tsx         # Password reset page
│       │   └── update-password/page.tsx       # Update password after reset
│       └── api/                               # Next.js API routes (proxied to Hono)
│           ├── v1/
│           │   ├── keys/route.ts              # GET/POST api keys (proxied)
│           │   ├── keys/[id]/route.ts         # DELETE api key (proxied)
│           │   └── documents/
│           │       ├── route.ts               # POST create, GET list (proxied)
│           │       └── [slug]/route.ts        # GET/PATCH/DELETE (proxied)
│           └── dashboard/                     # Dashboard API routes (proxied)
│               ├── upload/route.ts            # POST multipart ≤50 MB
│               ├── publish/route.ts           # POST editor publish
│               ├── images/upload/route.ts     # POST inline images ≤5 MB
│               ├── search/route.ts            # GET full-text search
│               ├── shares/[slug]/route.ts     # GET/PATCH/DELETE owner CRUD
│               ├── shares/[slug]/set-password/route.ts  # Share password management
│               ├── shares/[slug]/unlock/route.ts     # Password unlock with cookie
│               ├── analytics/track/route.ts    # Event tracking
│               ├── oembed/route.ts             # oEmbed JSON endpoint
│               └── teams/
│                   ├── route.ts                # GET/POST teams
│                   ├── [slug]/route.ts         # GET/PATCH/DELETE team
│                   ├── [slug]/invites/route.ts         # GET/POST invites
│                   ├── [slug]/invites/bulk/route.ts   # POST bulk invite
│                   ├── [slug]/invites/[id]/resend/route.ts  # POST resend invite
│                   ├── [slug]/events/route.ts         # GET team events
│                   ├── [slug]/shares/route.ts         # GET workspace shares
│                   └── [slug]/members/route.ts        # GET/POST members
│   ├── lib/                               # Web-specific libraries
│   │   ├── api-client.ts                  # API client for server components
│   │   ├── share-access-cookie.ts         # Share access cookie utilities
│   │   └── ...
│   ├── middleware.ts                      # Next.js middleware for auth
│   └── next.config.ts                     # Next.js config with API rewrites
├── api/                                 # Hono API server
│   └── src/
│       ├── app.ts                        # Hono app with all routes
│       ├── routes/                       # API route handlers
│       │   ├── v1/                       # Public REST API
│       │   │   ├── keys.ts               # API key CRUD
│       │   │   └── documents.ts          # Document CRUD
│       │   └── dashboard/                # Dashboard API
│       │       ├── upload.ts             # File upload
│       │       ├── publish.ts            # Editor publish
│       │       ├── images-upload.ts      # Image upload
│       │       ├── search.ts             # Full-text search
│       │       ├── shares.ts             # Share CRUD
│       │       ├── analytics.ts          # Analytics tracking
│       │       ├── oembed.ts             # oEmbed endpoint
│       │       └── teams.ts              # Team workspace CRUD
│       ├── lib/                          # API-specific libraries
│       │   ├── api-auth.ts               # API key authentication
│       │   ├── api-key.ts                # API key generation
│       │   ├── nanoid.ts                 # ID generation
│       │   ├── password.ts               # Password hashing
│       │   ├── extract-text.ts           # Text extraction
│       │   └── ...
│       └── middleware/                   # Hono middleware
│           ├── auth.ts                   # Authentication middleware
│           └── teams.ts                  # Team membership middleware
└── cli/                                 # CLI tool
    └── src/
        ├── index.ts                      # CLI entry point
        ├── commands/                     # CLI commands
        │   ├── publish.ts                # Publish files
        │   ├── list.ts                   # List documents
        │   ├── delete.ts                 # Delete documents
        │   ├── login.ts                  # Configure auth
        │   └── ...
        └── lib/                          # CLI libraries
            ├── api-client.ts             # API client (updated to use /v1/)
            └── config.ts                 # Config management
```

components/
├── ui/{button,card,input,textarea,dialog,select,badge,alert,sonner,skeleton}.tsx
├── editor-shell.tsx, editor-pane.tsx, editor-preview.tsx
├── editor-toolbar.tsx, editor-publish-bar.tsx
├── upload-dropzone.tsx, share-link.tsx
├── search-bar.tsx, search-results.tsx
├── html-viewer.tsx, markdown-viewer.tsx, markdown-viewer-wrapper.tsx
├── dashboard-share-card.tsx, bookmark-toggle.tsx
├── api-key-manager.tsx, profile-form.tsx
├── auth-user-menu.tsx, home-page.tsx, theme-provider.tsx
├── header-bar.tsx, header-nav.tsx, header-mobile-drawer.tsx
├── analytics/{stats-cards,view-chart,geo-chart,referrer-chart,top-performers,empty-state}.tsx
├── teams/{create-team-form,team-member-row,team-nav,team-share-card,invite-member-dialog,team-invite-form,enhanced-invite-dialog,bulk-invite-dialog,invite-accept-form,invite-status-card}.tsx
├── shares/{share-link,share-password-form,password-gate,share-viewed-tracker,share-analytics-tracker,embed-viewed-tracker,embed-snippet}.tsx
├── copy-button.tsx, bulk-invite-dialog.tsx, enhanced-invite-dialog.tsx

lib/
├── utils.ts, nanoid.ts, extract-text.ts, rate-limit.ts
├── api-auth.ts                        # API key hash + lookup
├── shiki-highlighter.ts
├── nav-links.ts                       # Navigation links configuration
├── use-auth-user.ts                   # Authentication state hook
├── use-email-validation.ts             # Email validation hook
├── use-team.ts                         # Team workspace hook
├── use-toast.ts                        # Toast notification hook
├── share-access-cookie.ts             # Password access cookie management
├── team-utils.ts                      # Workspace utilities
├── team-rpc.ts                        # Team RPC client for type-safe server calls
├── token-security.ts                  # Token security utilities for invite management
├── invite-utils.ts                   # Invitation system helpers
├── analytics-track.ts                 # Event tracking helpers
├── oembed-utils.ts                   # oEmbed metadata generation
├── referrer-parser.ts                 # Referrer URL parsing
├── password.ts                        # Password hashing helpers
└── editor-extensions/                 # CodeMirror slash commands, image drop

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
    └── 20260429_team_lifecycle_redesign.sql
```

## Key Architectural Patterns

### Dual Authentication Model
- **Cookie Session**: Browser users with OAuth/email auth via Supabase
- **API Key**: Programmatic access with SHA-256 hash lookup via `lib/api-auth.ts`

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
│  POST /api/upload     GET /s/[slug]    GET /api/search       │
│  POST /api/publish    GET/PATCH/DELETE /api/shares/[slug]    │
│  POST /api/images/upload                                     │
│  POST /api/shares/[slug]/unlock                              │
│  POST /api/shares/[slug]/set-password                        │
│  POST /api/analytics/track                                   │
│  GET /api/oembed                                             │
│  GET|POST /api/v1/keys    DELETE /api/v1/keys/[id]           │
│  POST /api/v1/documents   GET /api/v1/documents              │
│  GET /api/v1/documents/[slug]   PATCH|DELETE /api/v1/..      │
│  CRUD /api/dashboard/teams, /api/dashboard/teams/[slug]/*    │
│  Team Invite: /api/dashboard/teams/[slug]/invites/*         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  lib/api-auth.ts          utils/supabase/server.ts  │    │
│  │  lib/password.ts          lib/share-access-cookie.ts│    │
│  │  lib/rate-limit.ts        lib/team-rpc.ts           │    │
│  │  lib/token-security.ts    createClient()            │    │
│  │  createAdminClient()                                │    │
│  └────────┬──────────────────────┬──────────────────────┘   │
└───────────┼──────────────────────┼──────────────────────────┘
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