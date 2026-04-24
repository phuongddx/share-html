# System Architecture

## Overview

DropItX is a Next.js 16 application (App Router) deployed on Vercel with Supabase (PostgreSQL + Storage) and Upstash Redis (rate limiting). Supports two auth models: cookie-based session (browser) and API key (programmatic). Includes a CLI tool at `packages/cli/`.

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
│  GET|POST /api/v1/keys    DELETE /api/v1/keys/[id]           │
│  POST /api/v1/documents   GET /api/v1/documents              │
│  GET /api/v1/documents/[slug]   PATCH|DELETE /api/v1/..      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  lib/api-auth.ts     utils/supabase/server.ts       │    │
│  │  createClient()      createAdminClient()            │    │
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
  ──────────────────
  share-html publish <file>  →  POST /api/v1/documents
  share-html list            →  GET  /api/v1/documents
  share-html delete <slug>   →  DELETE /api/v1/documents/[slug]
  Config: ~/.share-html/config.json (mode 0600)
```

## Component Hierarchy

```
RootLayout (app/layout.tsx)
├── ThemeProvider
├── Toaster (sonner)
└── Routes
    ├── / (HomePage)
    │   ├── SearchBar
    │   ├── UploadDropzone
    │   └── ShareLink
    ├── /editor (Editor Page — SSR disabled via next/dynamic)
    │   └── EditorShell
    │       ├── EditorToolbar
    │       ├── EditorPane (CodeMirror 6)
    │       ├── EditorPreview (react-markdown + shiki)
    │       └── EditorPublishBar
    ├── /s/[slug] (SharePage)
    │   ├── HtmlViewer (sandboxed iframe, for .html files)
    │   ├── MarkdownViewerWrapper (lazy loaded, for .md files)
    │   └── BookmarkToggle
    ├── /search (SearchPage)
    │   ├── SearchBar
    │   └── SearchResults
    ├── /auth/login
    │   ├── Google OAuth button
    │   └── GitHub OAuth button
    ├── /dashboard
    │   ├── layout.tsx (sidebar nav)
    │   ├── page.tsx (share list + stats)
    │   │   ├── DashboardShareCard
    │   │   └── ApiKeyManager
    │   ├── profile/page.tsx → ProfileForm
    │   └── favorites/page.tsx → DashboardShareCard list
    └── /auth/callback (PKCE code exchange, bootstraps user_profiles)
```

## Authentication Architecture

### Session Auth (Browser)
```
User clicks OAuth button → /auth/login
  → supabase.auth.signInWithOAuth({ provider })
  → Redirect to Google or GitHub
  → /auth/callback
    → supabase.auth.exchangeCodeForSession()
    → INSERT user_profiles if first login
    → Redirect to /dashboard
```

### API Key Auth (Programmatic)
```
POST /api/v1/keys  →  generate shk_ + 48 hex chars
                   →  store SHA-256 hash + key_prefix in api_keys
                   →  return full key ONCE

Subsequent requests:
  Authorization: Bearer shk_...
  → lib/api-auth.ts: SHA-256 hash input key
  → SELECT from api_keys WHERE key_hash = ? AND revoked_at IS NULL
  → UPDATE last_used_at (async)
```

### Auth Layers
| Layer | Implementation |
|-------|---------------|
| Middleware | Routes `/dashboard/*` redirect unauthenticated to `/auth/login` |
| Session | Supabase SSR cookies, PKCE flow |
| OAuth | Google and GitHub via Supabase config |
| API Key | SHA-256 hash lookup in `api_keys`; soft-revoke via `revoked_at` |
| RLS | Owner-only on `user_profiles`, `favorites`, `api_keys`; private share filter |

### Supabase Client Usage
| Client | Export | Use Case |
|--------|--------|----------|
| Browser | `client.ts` | Client components, direct user interaction |
| Server (anon) | `server.ts → createClient()` | Server components, reads respecting RLS |
| Admin | `server.ts → createAdminClient()` | Mutations, storage ops (bypasses RLS) |

## Data Flow

### Upload Flow
```
User drops file → UploadDropzone (client: .html/.htm/.md, ≤50 MB)
  → POST /api/upload (multipart)
    → Rate limit check (Upstash Redis)
    → File validation (extension, MIME, size)
    → Upload to Supabase Storage (admin client)
    → Extract text (lib/extract-text.ts)
    → INSERT shares record (admin client)
    → On failure: compensating DELETE from storage
  → Return { slug, filename, deleteUrl, shareUrl }
  → ShareLink component
```

### Editor Publish Flow
```
EditorPane (CodeMirror) → user edits Markdown
  → useEditorAutoSave: persist draft to localStorage
  → EditorPublishBar: user sets title, custom_slug, is_private
  → POST /api/publish { content, title, custom_slug, is_private }
    → Auth: session cookie required
    → INSERT shares (source='editor', mime_type='text/markdown')
  → Redirect to /s/[slug]
```

### Image Upload Flow
```
User drags image into EditorPane
  → Editor extension catches drop event
  → POST /api/images/upload (multipart, PNG/JPG/GIF/WebP, ≤5 MB)
    → Auth: session cookie required
    → Upload to Supabase Storage (images/ prefix)
  → Return { url }
  → Editor inserts ![alt](url) at cursor
```

### API Publish Flow
```
CLI: share-html publish file.md
  → Read ~/.share-html/config.json for API key
  → POST /api/v1/documents { content, title, slug, is_private }
    → lib/api-auth.ts: hash Bearer token, lookup api_keys
    → INSERT shares (source='editor')
  → Return { slug, url }
```

### View Flow
```
GET /s/[slug]
  → Server component: fetch share (anon client — private filter via RLS)
  → Check expiration → 404 if expired
  → Download content from Storage (admin client)
  → RPC: increment_view_count(slug)
  → Branch by mime_type:
    → text/markdown → MarkdownViewer (lazy, react-markdown + shiki)
    → text/html → HtmlViewer (sandboxed iframe + CSP)
```

### API Key Lifecycle
```
POST /api/v1/keys (name)  →  create + return key once
GET  /api/v1/keys         →  list (prefix + created_at, never hash)
DELETE /api/v1/keys/[id]  →  set revoked_at = NOW()
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
| `is_private` | BOOLEAN | hidden from search/listing for non-owners |
| `updated_at` | TIMESTAMPTZ | updated by trigger |
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
| `created_at` | TIMESTAMPTZ | |
| — | UNIQUE(user_id, share_id) | |

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

### RPCs
- `search_shares(query, limit, offset)` — full-text search with ranking + highlighted snippets; filters `is_private` unless owner
- `increment_view_count(slug)` — atomic view counter

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

## Security Layers

| Layer | Implementation |
|-------|---------------|
| File validation | Extension (.html/.htm/.md), MIME type, size ≤ 50 MB |
| Image validation | MIME type (png/jpg/gif/webp), size ≤ 5 MB, auth required |
| Rate limiting | Upstash sliding window, 10 req/min per IP |
| HtmlViewer sandbox | `sandbox="allow-scripts"` + CSP meta tag |
| Delete protection | Random 32-char token (file-upload shares) |
| Slug validation | Regex pattern check on API routes |
| DB access | RLS for reads; service_role for writes |
| API key auth | SHA-256 hash stored; `revoked_at` soft-delete; prefix for display |
| Private shares | RLS + `search_shares` RPC filter non-owner requests |
| Compensating tx | Storage cleanup if DB insert fails |

## Infrastructure

| Service | Purpose | Provider |
|---------|---------|----------|
| Hosting | Serverless deployment | Vercel |
| Database | PostgreSQL + Storage | Supabase |
| Rate limiting | Redis sliding window | Upstash |
| CDN | Static assets + storage files | Vercel + Supabase |
