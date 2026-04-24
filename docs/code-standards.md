# Code Standards

## Overview

Standards for the DropItX codebase. Next.js 16 + TypeScript strict + Tailwind CSS 4. Monorepo with `packages/cli/`.

## File Naming

- **kebab-case** for all files: `upload-dropzone.tsx`, `rate-limit.ts`, `api-auth.ts`
- UI primitives in `components/ui/`: `button.tsx`, `card.tsx`
- Feature components in `components/`: `search-bar.tsx`, `editor-shell.tsx`
- Supabase utils in `utils/supabase/`: `client.ts`, `server.ts`, `middleware.ts`
- Editor extensions in `lib/editor-extensions/`
- Config files: `eslint.config.mjs`, `tsconfig.json`

## Project Structure

```
app/                  # Next.js App Router (pages, layouts, API routes)
app/editor/           # Markdown editor (SSR-disabled)
app/api/v1/           # Versioned REST API (API key auth)
components/ui/        # Reusable UI primitives (shadcn/ui)
components/           # Feature components
lib/                  # Utility functions
lib/editor-extensions/# CodeMirror extensions
utils/supabase/       # Supabase client factories
types/                # TypeScript interfaces
supabase/             # Schema and config
supabase/migrations/  # Incremental schema migrations
packages/cli/         # CLI tool (share-html binary)
public/               # Static assets
docs/                 # Documentation
```

## Monorepo Structure

`packages/cli/` is a standalone TypeScript ESM package:
- `package.json` with `"type": "module"`, `"bin": { "share-html": "dist/index.js" }`
- Build: `tsc` outputs to `dist/`
- Local link: `npm link` from `packages/cli/` for development
- Config stored at `~/.share-html/config.json` (mode 0600, never committed)

## TypeScript

- Strict mode enabled (`tsconfig.json`)
- Interfaces over types for object shapes
- DB column names use snake_case in types (matches Supabase): `storage_path`, `content_text`, `is_private`
- Prefer `async/await` over `.then()`
- Explicit return types on exported functions
- No `any` — use `unknown` and narrow

## React Patterns

- Functional components only (no classes)
- `"use client"` directive when using hooks, state, or browser APIs
- Server components by default for data-fetching pages
- Props via TypeScript interfaces, not PropTypes
- Keep components under 200 lines — split if larger
- CodeMirror: always load via `next/dynamic({ ssr: false })` — never import directly in server context

## Editor Integration (CodeMirror)

- Editor page at `app/editor/page.tsx` uses `next/dynamic({ ssr: false })` to load `EditorShell`
- `EditorPane` creates a single CodeMirror `EditorView`; do not re-create on re-render
- Theme switching via `Compartment` hot-swap (`compartment.reconfigure(...)`)
- Slash commands and image drop registered as CodeMirror extensions in `lib/editor-extensions/`
- Auto-save hook (`useEditorAutoSave`) debounces writes to `localStorage`

## API Routes

- `NextRequest` / `NextResponse` from `next/server`
- Consistent JSON error responses: `{ error: string }`
- Try/catch with proper HTTP status codes
- Input validation at route handler level
- Rate limiting via `lib/rate-limit.ts` on write endpoints (browser-auth routes)
- Multipart handling: use `request.formData()` for file uploads

### Versioned API Convention
- Routes under `/api/v1/` use API key auth only (no cookie fallback)
- Auth via `lib/api-auth.ts`: SHA-256 hash of Bearer token → lookup `api_keys`

### API Key Auth Pattern
```typescript
// lib/api-auth.ts pattern
const hash = crypto.createHash('sha256').update(token).digest('hex');
const { data } = await adminClient
  .from('api_keys')
  .select('id, user_id')
  .eq('key_hash', hash)
  .is('revoked_at', null)
  .single();
// async: update last_used_at without awaiting
```

### Multipart Handling Pattern
```typescript
const formData = await request.formData();
const file = formData.get('file') as File;
const buffer = Buffer.from(await file.arrayBuffer());
```

## Database Migrations

All schema changes live in `supabase/migrations/` as timestamped SQL files:
- **Naming**: `YYYYMMDDNNNNNN_description.sql` (e.g., `20260424000001_add_editor_columns.sql`)
- **Apply locally**: `supabase db reset` or `supabase db push`
- **Apply to hosted**: `supabase db push --linked`
- Never modify `schema.sql` for incremental changes — always add a migration file
- Each migration must be idempotent where possible (`IF NOT EXISTS`, `DO $$ ... $$`)

## Supabase Clients

Three client factories in `utils/supabase/`:

| Client | Export | Use Case |
|--------|--------|----------|
| Browser | `client.ts → createClient()` | Client components, user interaction |
| Server (anon) | `server.ts → createClient()` | Server components, reads (respects RLS) |
| Admin | `server.ts → createAdminClient()` | Writes, storage ops (bypasses RLS) |

Never use the admin client in client components — server-only.

## Error Handling

- API routes: try/catch → `{ error: message }` with appropriate HTTP status
- Components: Sonner toast for user-facing errors
- Rate limit: graceful degradation — if Redis unavailable, allow request but log warning
- Compensating transactions: if DB insert fails after storage upload, delete the stored file
- API key auth failures: return `401` with `{ error: "Unauthorized" }`

## Styling

- Tailwind CSS 4 utility classes only — no custom CSS-in-JS
- OKLCH color tokens via CSS custom properties in `app/globals.css`
- `cn()` from `lib/utils.ts` for conditional class merging (clsx + tailwind-merge)
- Component variants via `class-variance-authority`
- Dark mode via `.dark` class on `<html>` (next-themes)
- Blue accent design system (v1.0.0 overhaul) — `--primary` uses blue OKLCH values

## Security

- **File upload**: validate extension, MIME type, size (≤ 50 MB) at API layer
- **Image upload**: validate MIME type (png/jpg/gif/webp), size (≤ 5 MB), require session auth
- **HtmlViewer**: sandboxed iframe (`sandbox="allow-scripts"`) + CSP meta tag injection
- **Delete token**: random 32-char string, required for file-upload share deletion
- **Slug validation**: regex pattern check on API routes
- **Service role key**: server-only — never expose to client bundle
- **API key**: only SHA-256 hash + prefix stored; full key shown once at creation
- **`is_private`**: enforced at RLS level and in `search_shares` RPC — not just application logic

## Lint & Build

```bash
npm run lint    # ESLint (next config)
npm run build   # TypeScript check + Next.js build
# CLI:
cd packages/cli && npm run build
```

Fix lint errors before commit. Build must pass before push.

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- No AI references in commit messages
- Keep commits focused on actual changes
- Never commit `.env.local`, `~/.share-html/config.json`, or any secrets
