# DropItX

Drop HTML and Markdown files, write in the built-in editor, and get short shareable links. Programmatic access via REST API and CLI. Built as a Turborepo monorepo with Next.js 16, Hono API server, Supabase, and Tailwind CSS.

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

- **Turborepo** (monorepo with pnpm workspaces)
- **Next.js 16** (App Router, React 19) - web application
- **Hono** - API server
- **TypeScript** (strict mode)
- **Supabase** (PostgreSQL, Storage, Auth — Google/GitHub OAuth)
- **CodeMirror 6** (Markdown editor, SSR-disabled)
- **Tailwind CSS 4** + shadcn/ui (OKLCH violet accent tokens)
- **Upstash Redis** (rate limiting)
- **CLI**: `packages/cli/` — TypeScript ESM, binary `dropitx`

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Supabase project (or local via Supabase CLI)
- Upstash Redis instance

### Setup

```bash
# Install dependencies (from root)
pnpm install

# Copy and fill in environment variables
cp .env.example .env.local

# Start both API and web in parallel
pnpm dev

# Or start individually:
pnpm --filter @dropitx/api dev  # API on http://localhost:8787
pnpm --filter @dropitx/web dev  # Web on http://localhost:3000
```

### Environment Variables

#### Web Application (packages/web)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `API_URL` | API base URL for server-side calls (e.g., `http://localhost:8787`) |

#### API Server (packages/api)
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation |
| `CORS_ORIGIN` | Allowed CORS origin (e.g., `http://localhost:3000`) |

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

All v1 endpoints require `Authorization: Bearer <api-key>`. Generate keys at `/dashboard`.

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/documents` | Create document |
| `GET` | `/v1/documents` | List documents (`?limit=&offset=`) |
| `GET` | `/v1/documents/:slug` | Get metadata + URL |
| `PATCH` | `/v1/documents/:slug` | Update content/metadata |
| `DELETE` | `/v1/documents/:slug` | Delete (204) |

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
| `POST` | `/v1/keys` | Create API key (returned once) |
| `GET` | `/v1/keys` | List keys (prefix only, no hash) |
| `DELETE` | `/v1/keys/:id` | Revoke key (soft-delete) |

## Project Structure

```
packages/
├── shared/            # Shared utilities and types
├── web/              # Next.js web application
├── api/              # Hono API server
└── cli/              # CLI tool (dropitx binary)
supabase/             # Schema and migrations
docs/                 # Project documentation
```

## Scripts

- `pnpm dev` — Start both API and web in parallel (API on :8787, web on :3000)
- `pnpm build` — Build all packages in dependency order
- `pnpm type-check` — Run TypeScript checks across all packages
- `pnpm lint` — Run ESLint across all packages
- `pnpm --filter @dropitx/web dev` — Start web application only
- `pnpm --filter @dropitx/api dev` — Start API server only

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
