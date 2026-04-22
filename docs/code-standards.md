# Code Standards

## Overview

Standards for the Share HTML codebase. Next.js 16 + TypeScript 5 + Tailwind CSS 4.

## File Naming

- **kebab-case** for all files: `upload-dropzone.tsx`, `rate-limit.ts`
- UI primitives in `components/ui/`: `button.tsx`, `card.tsx`
- Feature components in `components/`: `search-bar.tsx`, `html-viewer.tsx`
- Supabase utils in `utils/supabase/`: `client.ts`, `server.ts`, `middleware.ts`
- Config files: `eslint.config.mjs`, `tsconfig.json`

## Project Structure

```
app/                  # Next.js App Router (pages, layouts, API routes)
components/ui/        # Reusable UI primitives (shadcn/ui + Base UI)
components/           # Feature components
lib/                  # Utility functions
utils/supabase/       # Supabase client factories
types/                # TypeScript interfaces
supabase/             # Schema and config
public/               # Static assets
docs/                 # Documentation
```

## TypeScript

- Strict mode enabled
- Interfaces over types for object shapes
- DB column names use snake_case in types (matches Supabase): `storage_path`, `content_text`, `file_size`
- Prefer `async/await` over `.then()`
- Explicit return types on exported functions
- No `any` — use `unknown` and narrow

## React Patterns

- Functional components only (no classes)
- `"use client"` directive when using hooks, state, or browser APIs
- Server components by default for data-fetching pages
- Props via TypeScript interfaces, not PropTypes
- Keep components under 200 lines — split if larger

## API Routes

- `NextRequest` / `NextResponse` from `next/server`
- Consistent JSON error responses: `{ error: string }`
- Try/catch with proper HTTP status codes
- Input validation at route handler level
- Rate limiting via `lib/rate-limit.ts` on write endpoints

## Supabase Clients

Three client factories in `utils/supabase/`:

| Client | File | Use Case |
|--------|------|----------|
| Browser | `client.ts` | Client components, direct user interaction |
| Server | `server.ts` → `createClient()` | Server components, reads (respects RLS) |
| Admin | `server.ts` → `createAdminClient()` | Server writes, storage ops (bypasses RLS) |

## Error Handling

- API routes: try/catch → `{ error: message }` with appropriate status code
- Components: Sonner toast for user-facing errors
- Rate limit: graceful degradation — if Redis unavailable, allow request but log warning
- Compensating transactions for upload: if DB insert fails after storage upload, delete the stored file

## Styling

- Tailwind CSS 4 utility classes only — no custom CSS-in-JS
- Theme tokens via CSS custom properties in `globals.css`
- `cn()` utility from `lib/utils.ts` for conditional class merging (clsx + tailwind-merge)
- Component variants via `class-variance-authority`
- Dark mode via `.dark` class on `<html>` (next-themes)

## Security

- File validation: extension, MIME type, size on upload
- HtmlViewer: sandboxed iframe (`sandbox="allow-scripts"`) + CSP injection
- Delete token: random 32-char string, required for deletion
- Slug validation: regex pattern check on API routes
- Service role key: server-only, never exposed to client

## Lint & Build

```bash
npm run lint    # ESLint (next config)
npm run build   # TypeScript check + Next.js build
```

Fix lint errors before commit. Build must pass before push.

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- No AI references in commit messages
- Keep commits focused on actual changes
