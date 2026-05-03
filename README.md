# DropItX

Drop HTML and Markdown files, write in the built-in editor, and get short shareable links. Programmatic access via REST API and CLI. Built with Next.js 16 (frontend), FastAPI (backend), Supabase, and Tailwind CSS.

## Features

- **Upload**: Drag-and-drop HTML and Markdown files (up to 50 MB)
- **Editor**: Markdown editor with live split-pane preview (CodeMirror 6)
- **Markdown**: GitHub-like rendered preview with syntax highlighting, toggle to raw source
- **Share**: Short slug-based URLs (`/s/abc123`), optional custom slugs
- **Private shares**: `is_private` flag hides shares from search and public listing
- **Search**: Full-text search across all content
- **Auth**: Google and GitHub OAuth; user dashboard, profile, favorites
- **API**: REST API v1 for programmatic document management (Bearer API key)
- **CLI**: `dropitx` binary for publish/update/delete from the terminal
- **Security**: Sandboxed iframe viewing with CSP, rate limiting, RLS on all tables
- **Themes**: Light/dark mode
- **Auto-expire**: Shares expire after 30 days

## Tech Stack

- **Next.js 16** (App Router, React 19) — pure frontend on Vercel
- **FastAPI** (Python) — backend API on Render
- **TypeScript** (strict mode)
- **Supabase** (PostgreSQL, Storage, Auth — Google/GitHub OAuth)
- **CodeMirror 6** (Markdown editor, SSR-disabled)
- **Tailwind CSS 4** + shadcn/ui (OKLCH violet accent tokens)
- **Upstash Redis** (rate limiting)
- **CLI**: `packages/cli/` — TypeScript ESM, binary `dropitx`

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (or local via Supabase CLI)
- Upstash Redis instance

### Setup

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env.local

# Run development server
npm run dev   # http://localhost:3000
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL (e.g. `https://dropitx-api.onrender.com`) |

### Database Setup

`supabase/schema.sql` is the base shares schema. Auth, editor, and API key tables live in `supabase/migrations/`.

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Manual alternative: run `supabase/schema.sql` then all files in `supabase/migrations/` in timestamp order.

## CLI Quick Start

```bash
# Build and link the CLI
cd packages/cli && npm install && npm run build && npm link

# Authenticate (generate an API key at /dashboard first)
dropitx login

# Publish a Markdown file
dropitx publish README.md -t "My Doc"

# Publish as private
dropitx publish notes.md -t "Private Notes" -p

# List your documents
dropitx list

# Update content
dropitx update abc123 updated.md

# Delete
dropitx delete abc123
```

## API Reference

All API endpoints are served by the FastAPI backend. v1 endpoints require `Authorization: Bearer <api-key>`. Generate keys at `/dashboard`.

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/documents` | Create document |
| `GET` | `/api/v1/documents` | List documents (`?limit=&offset=`) |
| `GET` | `/api/v1/documents/:slug` | Get metadata + URL |
| `PATCH` | `/api/v1/documents/:slug` | Update content/metadata |
| `DELETE` | `/api/v1/documents/:slug` | Delete (204) |

**Create document request body:**
```json
{
  "content": "# Hello\n\nMarkdown content here.",
  "title": "My Document",
  "slug": "my-custom-slug",
  "is_private": false
}
```

### API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/keys` | Create API key (returned once) |
| `GET` | `/api/v1/keys` | List keys (prefix only, no hash) |
| `DELETE` | `/api/v1/keys/:id` | Revoke key (soft-delete) |

## Project Structure

```
app/                  # Next.js App Router pages (pure frontend)
app/editor/           # Markdown editor (SSR-disabled)
app/api/              # Only OG image route remains
components/           # React components (ui/ for primitives)
lib/                  # Utilities (api-client, team-rpc, analytics, etc.)
lib/editor-extensions/# CodeMirror slash commands, image drop
utils/supabase/       # Supabase client factories (browser, server, admin)
types/                # TypeScript interfaces
supabase/             # Schema and migrations
packages/cli/         # CLI tool (dropitx binary)
public/               # Static assets
docs/                 # Project documentation
```

## Scripts

- `npm run dev` — Development server
- `npm run build` — Production build + TypeScript check
- `npm run lint` — ESLint

## Documentation

See `docs/` for detailed documentation:

- [Project Overview & PDR](docs/project-overview-pdr.md)
- [System Architecture](docs/system-architecture.md)
- [Codebase Summary](docs/codebase-summary.md)
- [Code Standards](docs/code-standards.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Design Guidelines](docs/design-guidelines.md)
- [Project Roadmap](docs/project-roadmap.md)
- [Changelog](docs/project-changelog.md)
