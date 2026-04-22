# System Architecture

## Overview

Share HTML is a Next.js 16 application deployed on Vercel with Supabase (PostgreSQL + Storage) and Upstash Redis (rate limiting). Single-page architecture with App Router.

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                  Browser                        │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Upload   │ │ View /s/ │ │ Search /search │  │
│  │ Dropzone │ │ Iframe   │ │ Results        │  │
│  └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       │             │               │            │
└───────┼─────────────┼───────────────┼────────────┘
        │             │               │
        ▼             ▼               ▼
┌─────────────────────────────────────────────────┐
│              Next.js (Vercel)                    │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │POST /api │ │GET /s/   │ │GET /api/search │  │
│  │/upload   │ │[slug]    │ │                │  │
│  └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│       │             │               │            │
│  ┌────┴─────────────┴───────────────┴────────┐  │
│  │  Supabase Server Utils                   │  │
│  │  createClient()  createAdminClient()     │  │
│  └────┬──────────────────────┬──────────────┘  │
└───────┼──────────────────────┼─────────────────┘
        │                      │
        ▼                      ▼
┌───────────────┐  ┌──────────────────────┐
│  Supabase     │  │  Upstash Redis       │
│  PostgreSQL   │  │  Rate Limiting       │
│  Storage S3   │  │  (10 req/min/IP)     │
└───────────────┘  └──────────────────────┘
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
    ├── /s/[slug] (SharePage)
    │   └── HtmlViewer (sandboxed iframe)
    ├── /search (SearchPage)
    │   ├── SearchBar
    │   └── SearchResults
    └── API Routes
        ├── POST /api/upload
        ├── DELETE /api/shares/[slug]
        └── GET /api/search
```

## Data Flow

### Upload Flow
```
User drops file → UploadDropzone (client validation: .html, ≤10MB)
  → POST /api/upload ( FormData )
    → Rate limit check (Upstash Redis)
    → File validation (extension, MIME, size)
    → Upload to Supabase Storage (admin client)
    → Extract text from HTML (lib/extract-text.ts)
    → Insert DB record with slug, content_text (admin client)
    → On failure: compensating delete from storage
  → Return { slug, filename, deleteUrl, shareUrl }
  → ShareLink component displays results
```

### View Flow
```
GET /s/[slug]
  → Server component: fetch share from DB (anon client)
  → Check expiration → 404 if expired
  → Download HTML from Storage (admin client)
  → RPC: increment_view_count(slug)
  → HtmlViewer: sandboxed iframe + CSP meta tag injection
```

### Search Flow
```
User types → SearchBar (debounce 300ms)
  → Navigate to /search?q=...
  → Client component: GET /api/search?q=&limit=&offset=
    → Supabase RPC: search_shares(query, limit, offset)
    → Uses websearch_to_tsquery + ts_rank for relevance
    → Only non-expired shares
  → SearchResults component renders cards with highlighted snippets
```

### Delete Flow
```
DELETE /api/shares/[slug] + delete_token
  → Validate slug format (regex)
  → Lookup share, verify delete_token
  → Delete from Storage (admin client)
  → Delete from DB (admin client)
  → On storage failure: log error but don't stop (DB still deleted)
```

## Database Schema

### `shares` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `slug` | VARCHAR(10, UNIQUE) | nanoid, URL identifier |
| `filename` | VARCHAR(255) | Original filename |
| `storage_path` | TEXT | Path in Supabase Storage |
| `content_text` | TEXT (≤100KB) | Extracted text for search |
| `search_vec` | TSVECTOR (generated) | Weighted full-text index (A: filename, B: content) |
| `file_size` | INTEGER | File size in bytes |
| `mime_type` | VARCHAR(100) | Default `text/html` |
| `delete_token` | VARCHAR(32) | Required for deletion |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `expires_at` | TIMESTAMPTZ | Default: NOW() + 30 days |
| `view_count` | INTEGER | Atomic increment via RPC |

### Indexes
- `idx_shares_slug` (UNIQUE) — slug lookup
- `idx_shares_search` (GIN) — full-text search
- `idx_shares_expires` — expiration queries
- `idx_shares_created` (DESC) — recent shares

### RLS
- Public SELECT (anyone can read/view/search)
- Server writes via service_role (bypasses RLS)

### RPCs
- `search_shares(query, limit, offset)` — full-text search with ranking + highlighted snippets
- `increment_view_count(slug)` — atomic view count increment

## Storage

- **Bucket**: `html-files` (public, 10MB max)
- **Path format**: `{uuid-v4}.html`
- **Access**: Public read via Supabase CDN, admin-only write

## Security Layers

| Layer | Implementation |
|-------|---------------|
| File validation | Extension (.html/.htm), MIME type, size ≤10MB |
| Rate limiting | Upstash sliding window, 10 req/min per IP |
| HtmlViewer sandbox | `sandbox="allow-scripts"` + CSP meta tag |
| Delete protection | Random 32-char token required |
| Slug validation | Regex pattern check on API routes |
| DB access | RLS for reads, service_role for writes |
| Compensating tx | Storage cleanup if DB insert fails |

## Infrastructure

| Service | Purpose | Provider |
|---------|---------|----------|
| Hosting | Serverless deployment | Vercel |
| Database | PostgreSQL + Storage | Supabase |
| Rate limiting | Redis sliding window | Upstash |
| CDN | Static assets + storage | Vercel + Supabase |
