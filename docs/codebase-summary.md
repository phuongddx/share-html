# Codebase Summary

## Overview

DropItX is a Next.js 16 (App Router) application for uploading HTML/Markdown files and publishing Markdown via a built-in editor, generating short shareable links. Supports cookie-based session auth (browser) and API key auth (programmatic). Deployed on Vercel with Supabase (PostgreSQL + Storage) and Upstash Redis.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Editor | CodeMirror 6, loaded via `next/dynamic` (ssr: false) |
| Viewer | `react-markdown` + `remark-gfm` + shiki |
| Database | Supabase PostgreSQL (RLS), Storage (S3-compatible) |
| Auth | Supabase Auth (Google + GitHub OAuth, PKCE), `@supabase/ssr` |
| Styling | Tailwind CSS 4, shadcn/ui, OKLCH color tokens |
| Rate limiting | Upstash Redis |
| File upload | `react-dropzone` |
| Theming | `next-themes` |
| CLI | `packages/cli/` — TypeScript ESM, binary `dropitx` |

## File Structure Overview

```
app/
├── layout.tsx, page.tsx, globals.css, not-found.tsx, error.tsx
├── editor/page.tsx                     # Markdown editor (SSR-disabled)
├── s/[slug]/page.tsx, loading.tsx      # Public share viewer
├── search/page.tsx, loading.tsx        # Full-text search
├── dashboard/
│   ├── layout.tsx, page.tsx            # Share list + stats + API keys
│   ├── profile/page.tsx
│   └── favorites/page.tsx
├── auth/
│   ├── login/page.tsx
│   └── callback/route.ts              # PKCE code exchange
└── api/
    ├── upload/route.ts                # POST multipart ≤50 MB
    ├── publish/route.ts               # POST editor publish
    ├── images/upload/route.ts         # POST inline images ≤5 MB
    ├── search/route.ts                # GET full-text search
    ├── shares/[slug]/route.ts         # GET/PATCH/DELETE owner CRUD
    └── v1/
        ├── keys/route.ts              # GET/POST api keys
        ├── keys/[id]/route.ts         # DELETE (revoke) api key
        └── documents/
            ├── route.ts               # POST create, GET list
            └── [slug]/route.ts        # GET/PATCH/DELETE

components/
├── ui/{button,card,input,sonner}.tsx
├── editor-shell.tsx, editor-pane.tsx, editor-preview.tsx
├── editor-toolbar.tsx, editor-publish-bar.tsx
├── upload-dropzone.tsx, share-link.tsx
├── search-bar.tsx, search-results.tsx
├── html-viewer.tsx, markdown-viewer.tsx, markdown-viewer-wrapper.tsx
├── dashboard-share-card.tsx, bookmark-toggle.tsx
├── api-key-manager.tsx, profile-form.tsx
├── auth-user-menu.tsx, home-page.tsx, theme-provider.tsx

lib/
├── utils.ts, nanoid.ts, extract-text.ts, rate-limit.ts
├── api-auth.ts                        # API key hash + lookup
├── shiki-highlighter.ts
└── editor-extensions/                 # CodeMirror slash commands, image drop

utils/supabase/
├── client.ts, server.ts, middleware.ts

types/
└── share.ts

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
    └── 20260424000003_private_search_filter.sql

docs/                                  # Project documentation
public/                                # Static assets
```

## Application Pages

| Route | Description |
|-------|-------------|
| `/` | Upload dropzone, search bar |
| `/editor` | Markdown editor with live split-pane preview (CodeMirror, SSR-disabled) |
| `/s/[slug]` | Public share viewer (HTML iframe or Markdown prose) |
| `/search` | Full-text search |
| `/dashboard` | Auth user share list, stats, API key management |
| `/dashboard/profile` | Edit display name / avatar |
| `/dashboard/favorites` | Bookmarked shares |
| `/auth/login` | OAuth sign-in (Google + GitHub) |
| `/auth/callback` | PKCE code-exchange, bootstraps `user_profiles` |

## API Routes

### Browser / Session Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/upload` | Multipart file upload (HTML/MD, max 50 MB) |
| POST | `/api/publish` | Editor publish (content, title, custom_slug, is_private) |
| POST | `/api/images/upload` | Inline image upload (PNG/JPG/GIF/WebP, max 5 MB) |
| GET | `/api/search?q=` | Full-text search via Postgres RPC |
| GET/PATCH/DELETE | `/api/shares/[slug]` | Owner CRUD |
| GET/POST | `/api/v1/keys` | List / create API keys |
| DELETE | `/api/v1/keys/[id]` | Soft-revoke API key |

### REST API (Bearer API Key)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/documents` | Create from Markdown content |
| GET | `/api/v1/documents` | List own documents (limit/offset) |
| GET | `/api/v1/documents/[slug]` | Get metadata + URL |
| PATCH | `/api/v1/documents/[slug]` | Update content/metadata |
| DELETE | `/api/v1/documents/[slug]` | Delete (204) |

## Component Architecture

### Editor Components
- **EditorShell**: Top-level editor layout, orchestrates sub-panels
- **EditorPane**: CodeMirror 6 instance; theme via Compartment hot-swap; slash commands + image drop extensions
- **EditorPreview**: Live Markdown rendering (react-markdown + shiki)
- **EditorToolbar**: Format actions, keyboard shortcuts
- **EditorPublishBar**: Title, custom slug, is_private toggle, publish button

### Upload / Share Components
- **UploadDropzone**: react-dropzone; state machine (idle/dragging/uploading/success/error)
- **ShareLink**: Share URL display, copy-to-clipboard, delete link
- **HtmlViewer**: Sandboxed iframe + CSP meta tag injection
- **MarkdownViewer**: react-markdown + remark-gfm + shiki, preview/raw toggle
- **MarkdownViewerWrapper**: `next/dynamic` wrapper for client-side only load

### Dashboard / Auth Components
- **DashboardShareCard**: Share card with stats, edit, delete
- **ApiKeyManager**: Create/list/revoke API keys
- **BookmarkToggle**: Add/remove favorites
- **ProfileForm**: Edit display name and avatar
- **AuthUserMenu**: Header dropdown (profile, logout)

### Core UI
- **SearchBar**: Debounced (300 ms) input → URL params navigation
- **SearchResults**: Paginated cards, skeleton loading, empty state
- **ThemeProvider**: next-themes class-based dark/light toggle

## Library Modules

| File | Purpose |
|------|---------|
| `lib/utils.ts` | `cn()` class name helper (clsx + tailwind-merge) |
| `lib/nanoid.ts` | URL-safe slug + token generation |
| `lib/extract-text.ts` | HTML/Markdown text extraction for search indexing |
| `lib/rate-limit.ts` | Upstash Redis-based rate limiting |
| `lib/api-auth.ts` | SHA-256 hash + `api_keys` lookup for Bearer auth |
| `lib/shiki-highlighter.ts` | Shiki singleton, curated languages |
| `lib/editor-extensions/` | CodeMirror slash commands, image drag-and-drop |

## Database Schema (4 Tables)

| Table | Key Columns |
|-------|------------|
| `shares` | id, slug, filename, storage_path, content_text, search_vec, file_size, mime_type, delete_token, user_id, title, custom_slug, source, is_private, expires_at, view_count |
| `user_profiles` | id (FK auth.users), display_name, avatar_url |
| `favorites` | id, user_id, share_id, UNIQUE(user_id, share_id) |
| `api_keys` | id, user_id, name, key_hash, key_prefix, last_used_at, revoked_at |

## CLI Tool (`packages/cli/`)

Binary: `dropitx`. Config: `~/.dropitx/config.json` (mode 0600).

| Command | Description |
|---------|-------------|
| `login` | Store API key to config |
| `publish <file> [-t title] [-p] [-s slug]` | Publish file via `/api/v1/documents` |
| `update <slug> <file>` | Update content via PATCH |
| `delete <slug>` | Delete document |
| `list [-n limit]` | List own documents |
| `whoami` | Show current user info |

## Key Architectural Patterns

- **Dual auth model**: Cookie session (browser) + API key (programmatic); `lib/api-auth.ts` handles key hashing
- **Compensating transactions**: Delete storage object if DB insert fails
- **Soft revocation**: `revoked_at` preserves `api_keys` audit history
- **RLS layering**: All 4 tables have RLS; private shares hidden unless owner; admin client bypasses for mutations
- **Generated TSVECTOR**: Full-text search with GIN index + `search_shares` RPC; private filter in RPC
- **CodeMirror SSR guard**: Editor loaded via `next/dynamic { ssr: false }`; theme via Compartment hot-swap
- **Auto-draft**: `useEditorAutoSave` persists to localStorage; dirty-state unload warning
- **Custom slugs**: `handle/slug` format stored in `custom_slug`; partial unique index
