# System Architecture

## Overview

DropItX is a Next.js 16 application (App Router) deployed on Vercel as a pure frontend. All API logic runs on a FastAPI backend (`dropitx-api.onrender.com`) with Supabase (PostgreSQL + Storage) and Upstash Redis (rate limiting). Features include team workspaces, analytics dashboard, password-protected shares, rich embedding via oEmbed, and programmatic access via REST API. Supports two auth models: JWT Bearer token (browser) and API key (programmatic). Version 2.3.0 migrated all API routes from Next.js to FastAPI.

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
```

## Component Hierarchy

```
RootLayout (app/layout.tsx)
├── ThemeProvider
├── Toaster (sonner)
└── HeaderBar (compound component system)
    ├── HeaderNav (desktop navigation)
    └── HeaderMobileDrawer (mobile navigation)
└── Routes
    ├── / (HomePage)
    │   ├── SearchBar
    │   ├── UploadDropzone
    │   └── ShareLink
    ├── /editor (SSR disabled via next/dynamic)
    │   └── EditorShell
    │       ├── EditorToolbar
    │       ├── EditorPane (CodeMirror 6)
    │       ├── EditorPreview (react-markdown + shiki)
    │       └── EditorPublishBar
    ├── /s/[slug] (SharePage)
    │   ├── PasswordGate (when share has password)
    │   ├── HtmlViewer (sandboxed iframe, .html files)
    │   ├── MarkdownViewerWrapper (lazy loaded, .md files)
    │   ├── BookmarkToggle
    │   ├── ShareViewedTracker
    │   └── ShareAnalyticsTracker
    ├── /embed/[slug] (oEmbed viewer)
    │   ├── EmbedViewedTracker
    │   └── EmbedSnippet
    ├── /search
    │   ├── SearchBar
    │   └── SearchResults
    ├── /auth/login
    │   ├── Email/password sign-in form
│   ├── Google OAuth button
    │   ├── GitHub OAuth button
│   └── Email auth components
├── /auth/reset-password
│   └── Password reset form
├── /auth/update-password
│   └── Password update form (after email reset)
├── /auth/confirm
│   └── Email confirmation page
└── /dashboard
    │   ├── layout.tsx (sidebar nav)
    │   ├── page.tsx (share list + stats)
    │   │   ├── DashboardShareCard (with password toggle)
    │   │   └── ApiKeyManager
    │   ├── profile/page.tsx → ProfileForm
    │   ├── favorites/page.tsx → DashboardShareCard list
    │   ├── analytics/page.tsx
    │   │   ├── AnalyticsStatsCards
    │   │   ├── AnalyticsViewChart
    │   │   ├── AnalyticsGeoChart
    │   │   ├── AnalyticsReferrerChart
    │   │   ├── AnalyticsTopPerformers
    │   │   └── AnalyticsEmptyState
    │   ├── analytics/[slug]/page.tsx → per-share analytics
    │   ├── teams/page.tsx → team list
    │   ├── teams/new/page.tsx → CreateTeamForm
    │   ├── teams/[slug]/page.tsx → team detail
    │   ├── teams/[slug]/members/page.tsx → TeamMemberRow, InviteMemberDialog
    │   └── teams/[slug]/settings/page.tsx → team settings
    └── /auth/callback (PKCE code exchange, bootstraps user_profiles)
```

## Authentication Architecture

### Session Auth (Browser)
```
User clicks OAuth → /auth/login
  → supabase.auth.signInWithOAuth({ provider })
  → Redirect to Google/GitHub
  → /auth/callback → exchangeCodeForSession() + INSERT user_profiles
  → Redirect to /dashboard

Email/Password Auth → /auth/login (split-screen)
  → Email signup + validation flow
  → Password reset flow (request → email → update)
  → Email confirmation page
  → PKCE flow for email authentication
```

### API Key Auth (Programmatic)
```
POST /api/v1/keys  →  FastAPI: generate shk_ + 48 hex chars
  →  store SHA-256 hash + key_prefix in api_keys
  →  return full key ONCE

Requests: Authorization: Bearer shk_...
  → FastAPI: SHA-256 hash → SELECT from api_keys WHERE key_hash = ?
```

### Share Access Cookie (Password-Protected)
```
POST /api/shares/[slug]/unlock { password }
  → FastAPI: bcryptjs.compare(password, shares.password_hash)
  → On match: HMAC-SHA256 signed cookie (SHARE_ACCESS_SECRET)
  → Set-Cookie: share_access_{slug}=<signed>; HttpOnly; SameSite=Lax; Max-Age=86400
```

### Auth Layers
| Layer | Implementation |
|-------|---------------|
| Middleware | `/dashboard/*` redirect unauthenticated to `/auth/login` |
| Session | Supabase SSR cookies, PKCE flow |
| OAuth | Google, GitHub, and email/password via Supabase config |
| API Key | SHA-256 hash lookup; soft-revoke via `revoked_at` |
| Share access cookie | HMAC-SHA256 signed HttpOnly cookie; 24 h TTL |
| RLS | Owner-only on `user_profiles`, `favorites`, `api_keys`; private share filter |

### Supabase Client Usage
| Client | Export | Use Case |
|--------|--------|----------|
| Browser | `client.ts` | Client components |
| Server (anon) | `server.ts → createClient()` | Server components, reads respecting RLS |
| Admin | `server.ts → createAdminClient()` | Mutations, storage ops (bypasses RLS) |

## Data Flow

### Upload Flow
```
User drops file → UploadDropzone (.html/.htm/.md, ≤50 MB)
  → authFetch("/api/upload") → FastAPI: rate limit → validate → upload to Storage
  → extract text → INSERT shares → on failure: compensating DELETE from storage
  → Return { slug, shareUrl }
```

### Editor Publish Flow
```
EditorPane → useEditorAutoSave (localStorage draft)
  → EditorPublishBar: title, custom_slug, is_private
  → authFetch("/api/publish") { content, title, custom_slug, is_private }
  → FastAPI: INSERT shares (source='editor') → redirect to /s/[slug]
```

### Image Upload Flow
```
Image dropped in EditorPane → authFetch("/api/images/upload") (≤5 MB)
  → FastAPI: Upload to Storage (images/ prefix) → insert ![alt](url) at cursor
```

### View Flow
```
GET /s/[slug] → fetch share (anon client) → check expiration
  → Access gate: owner bypass → private check → access cookie → password gate → auth gate
  → Download from Storage → increment_view_count → render by mime_type
```

### API Key Lifecycle
```
POST /api/v1/keys (name) → create + return key once
GET  /api/v1/keys        → list (prefix only, never hash)
DELETE /api/v1/keys/[id]  → set revoked_at = NOW()
```

## Database Schema

### `shares` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | auto-generated |
| `slug` | VARCHAR(10) UNIQUE | nanoid, URL identifier |
| `filename` | VARCHAR(255) | original filename |
| `storage_path` | TEXT | path in Supabase Storage |
| `content_text` | TEXT | extracted text for search |
| `search_vec` | TSVECTOR (GENERATED) | weighted index (A: filename, B: content) |
| `file_size` | INTEGER | bytes |
| `mime_type` | VARCHAR(100) | default `text/html` |
| `delete_token` | VARCHAR(32) | required for file-upload deletion |
| `user_id` | UUID FK (nullable) | links to `auth.users` |
| `title` | TEXT | display title |
| `custom_slug` | VARCHAR(100) UNIQUE PARTIAL | `handle/slug` format |
| `source` | TEXT | `'upload'` or `'editor'` |
| `is_private` | BOOLEAN | hidden from search/listing |
| `password_hash` | TEXT (nullable) | bcryptjs hash; never sent to client |
| `updated_at` | TIMESTAMPTZ | trigger-updated |
| `created_at` | TIMESTAMPTZ | auto-set |
| `expires_at` | TIMESTAMPTZ | default NOW() + 30 days |
| `view_count` | INTEGER | atomic increment via RPC |

### `user_profiles` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK FK → auth.users | |
| `display_name` | TEXT | editable |
| `avatar_url` | TEXT | editable |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | trigger-updated |

### `favorites` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `share_id` | UUID FK | |
| `created_at` | TIMESTAMPTZ | UNIQUE(user_id, share_id) |

### `api_keys` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `name` | TEXT | user-supplied label |
| `key_hash` | VARCHAR(64) | SHA-256 of full key |
| `key_prefix` | VARCHAR(12) | display only (`shk_xxxxxx`) |
| `last_used_at` | TIMESTAMPTZ | async update on auth |
| `created_at` | TIMESTAMPTZ | |
| `revoked_at` | TIMESTAMPTZ nullable | soft-delete |

### `team_workspaces` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | auto-generated |
| `name` | TEXT | workspace name |
| `description` | TEXT | nullable |
| `owner_id` | UUID FK → auth.users | workspace owner |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | trigger-updated |

### `workspace_members` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK → team_workspaces | |
| `user_id` | UUID FK → auth.users | |
| `role` | TEXT | `'owner'` or `'member'` |
| `created_at` | TIMESTAMPTZ | UNIQUE(workspace_id, user_id) |

### `workspace_shares` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK → team_workspaces | |
| `share_id` | UUID FK → shares | |
| `user_id` | UUID FK → auth.users | |
| `created_at` | TIMESTAMPTZ | UNIQUE(workspace_id, share_id) |

### `analytics_events` table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | auto-generated |
| `event_type` | TEXT | `'page_view'`, `'search'`, `'upload'`, `'api_call'` |
| `user_id` | UUID FK (nullable) | authenticated user |
| `session_id` | UUID | anonymous session tracking |
| `metadata` | JSONB | event-specific data |
| `user_agent` | TEXT | browser/user agent string |
| `ip_address` | INET | client IP |
| `created_at` | TIMESTAMPTZ | auto-set |

### RPCs
- `search_shares(query, limit, offset)` — full-text search with ranking + highlighted snippets
- `increment_view_count(slug)` — atomic view counter
- `get_user_workspaces(user_id)` — list workspaces for a user
- `is_user_in_workspace(user_id, workspace_id)` — check workspace access
- `get_workspace_shares(workspace_id)` — list shares in a workspace

## Storage

- **Bucket**: `html-files` (public, 50 MB max)
- **Uploaded files path**: `{uuid}.html` or `{uuid}.md`
- **Editor images path**: `images/{uuid}.{ext}`
- **Access**: Public read via Supabase CDN; admin-only write

## Migrations

| File | Creates |
|------|---------|
| `20260423000001_add_auth_tables.sql` | `user_profiles`, `favorites`, `shares.user_id`, `shares.title` |
| `20260424000001_add_editor_columns.sql` | `shares.source`, `shares.custom_slug`, `shares.is_private`, `shares.updated_at` |
| `20260424000002_add_api_keys.sql` | `api_keys` table + RLS |
| `20260424000003_private_search_filter.sql` | Updates `search_shares` RPC to filter private shares |
| `20260425000001_add_share_password.sql` | `shares.password_hash` |
| `20260425045621_rate-limits-supabase.sql` | Rate limiting policies |
| `20260426000001_share_views.sql` | Share view tracking |
| `20260426000002_teams.sql` | `team_workspaces`, `workspace_members`, `workspace_shares` |
| `20260428000001_fix_team_owner_trigger_rls.sql` | RLS fixes for team owner |
| `20260428000002_fix_team_members_rls_recursion.sql` | Fix infinite recursion |
| `20260428000003_fix_teams_insert_policy.sql` | Team member insert policy fixes |
| `20260428000004_fix_rls_policies_use_anon_role.sql` | RLS policy anon role updates |
| `20260428162629_fix_rls_policies_to_authenticated.sql` | RLS policies to authenticated role |
| `20260429_team_lifecycle_redesign.sql` | Team lifecycle redesign with event sourcing |
| `20260429180000_decline_team_invite.sql` | Decline invite RPC with email validation |
| `20260430121500_fix_ambiguous_team_id_in_invite_policies.sql` | Fix ambiguous team_id in invite policies |

## Security Layers

| Layer | Implementation |
|-------|---------------|
| File validation | Extension (.html/.htm/.md), MIME type, size ≤ 50 MB |
| Image validation | MIME type (png/jpg/gif/webp), size ≤ 5 MB, auth required |
| Rate limiting | Upstash sliding window: 10 req/min per IP (upload/API); 5 attempts/10 min per IP (password unlock) |
| HtmlViewer sandbox | `sandbox="allow-scripts"` + CSP meta tag |
| Delete protection | Random 32-char token (file-upload shares) |
| Slug validation | Regex pattern check on API routes |
| DB access | RLS for reads; service_role for writes |
| API key auth | SHA-256 hash stored; `revoked_at` soft-delete |
| Private shares | RLS + `search_shares` RPC filter non-owner |
| Password protection | bcryptjs hash; HMAC-SHA256 signed HttpOnly access cookie (24 h) |
| Compensating tx | Storage cleanup if DB insert fails |
| Workspace access | RLS on `team_workspaces`, `workspace_members`, `workspace_shares` |

## oEmbed Endpoint

```
GET /api/oembed?url=https://dropitx.app/s/{slug}  → JSON + HTML embed code
```
Response includes: type (rich), provider_name, title, author, iframe embed HTML (800x600).
Security: domain validation, rate limiting, CSP headers for embedded content.

## Analytics Tracking

- **Page Views**: `GET /s/[slug]` captures view events
- **Custom Tracking**: `lib/analytics-track.ts` + `lib/analytics.ts`
- **Vercel Analytics**: `@vercel/analytics` integration
- **Dashboard**: `/dashboard/analytics` with charts (Recharts)
- **Per-share**: `/dashboard/analytics/[slug]` for individual share metrics
- **Components**: StatsCards, ViewChart, GeoChart, ReferrerChart, TopPerformers

## Team Workspaces

- **Creation**: Owner creates workspace, auto-added as member
- **Members**: Owner invites via `/api/dashboard/teams/[slug]/invites`
- **Content**: Members share content to workspace via `workspace_shares` junction
- **RLS**: All workspace tables enforce membership-based access control
- **API**: CRUD under `/api/dashboard/teams/[slug]/` — members, invites, shares
- **Enhanced Invite System**: 
  - Single invite with role selection and email validation
  - Bulk invite with multiple email addresses support
  - Invite resend functionality
  - Invite accept flow with team join
  - Team RPC client for type-safe server communication
  - Token security utilities for invite token management
