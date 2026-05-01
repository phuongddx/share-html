# Brainstorm: Turborepo Monorepo Migration

**Date:** 2026-04-30
**Status:** Approved — pending implementation plan
**Approach:** A — Hono standalone API + Turborepo + pnpm

---

## Problem Statement

DropItX is a single Next.js 16 app (~12K LOC) with 25 API route handlers, a CLI package, and two auth layers (cookie + API key). Near-term requirements demand:

- Standalone API deployment (mobile app, external consumers, different infra)
- Clean separation of frontend and backend concerns
- Shared code reuse across packages (types, Supabase clients, utilities)
- Monorepo tooling for build caching and workspace management

## Evaluated Approaches

### A: Turborepo + Hono Standalone API (Selected)

Full extraction of API routes to a Hono server. Next.js web app communicates via HTTP fetch, passing JWT from cookie session as Bearer token.

**Pros:**
- True deployment independence — Hono runs on Vercel, Cloudflare Workers, Fly.io, bare Node
- Clean consumer story for mobile/external/CLI
- Auth naturally splits: cookie auth stays in Next.js middleware, API key + JWT auth in Hono
- Hono's API is close to Next.js route handlers — mechanical rewrite

**Cons:**
- Rewrite 25 route handlers (3-5 day effort)
- Two deploy targets to manage
- Network hop for web→API calls (mitigated by co-located Vercel deployment)

### B: Incremental Business Logic Extraction (Rejected)

Extract business logic to `packages/core`, keep Next.js route handlers as thin wrappers.

**Rejected because:** User needs standalone API deployment near-term. This approach defers that to a second phase, doubling total migration effort.

### C: Hono on Vercel Hybrid (Rejected)

Same as A but both apps on Vercel.

**Rejected because:** Same effort as A but locks API to Vercel. Contradicts the "different infra" requirement.

---

## Final Architecture

```
dropitx/
├── packages/
│   ├── web/              # Next.js 16 — pages, components, cookie auth, SSR
│   │   ├── app/          # App Router pages (no API routes except auth callbacks)
│   │   ├── components/   # React components
│   │   ├── hooks/        # React hooks
│   │   ├── middleware.ts  # Supabase SSR cookie auth
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api/              # Hono server — all API routes
│   │   ├── src/
│   │   │   ├── index.ts          # Hono app entry
│   │   │   ├── middleware/       # Auth (JWT + API key), rate limiting, CORS
│   │   │   ├── routes/           # Route modules (mirrors current app/api/ structure)
│   │   │   │   ├── v1/           # Public REST API
│   │   │   │   ├── shares/       # Share operations
│   │   │   │   ├── dashboard/    # Dashboard operations
│   │   │   │   ├── upload.ts
│   │   │   │   ├── publish.ts
│   │   │   │   ├── search.ts
│   │   │   │   └── analytics.ts
│   │   │   └── lib/              # API-specific utilities (OG image, oembed)
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared/           # Types, Supabase clients, shared utilities
│   │   ├── src/
│   │   │   ├── types/            # TypeScript interfaces (share, team, analytics, team-event)
│   │   │   ├── supabase/         # Client factories (browser, server, admin)
│   │   │   ├── validation/       # Slug validation, input sanitization
│   │   │   └── utils/            # nanoid, extract-text, shared helpers
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/              # Stays as-is (already isolated)
├── supabase/             # Schema + migrations (root-level, shared)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json          # Root workspace config
└── tsconfig.base.json    # Shared TypeScript config
```

## Auth Architecture (Post-Migration)

```
Browser → Next.js middleware → Supabase SSR cookie → session
  │
  └→ Server Component/Action → fetch(API_URL, { Authorization: Bearer <JWT> })
                                        │
                                        ▼
                                   Hono API
                                   ├── JWT validation (Supabase verify)
                                   ├── API key validation (shk_, sht_)
                                   └── Rate limiting (Upstash Redis)

Mobile App → Hono API (JWT from Supabase client auth)
CLI        → Hono API (API key from ~/.dropitx/config.json)
External   → Hono API (API key)
```

### Web→API Communication Pattern

```typescript
// packages/web — server component or server action
import { createClient } from '@dropitx/shared/supabase/server';

async function getDocuments() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.API_URL}/v1/documents`, {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  return res.json();
}
```

```typescript
// packages/api — Hono middleware
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';

const app = new Hono();

// JWT auth (from web app / mobile)
app.use('/v1/*', jwt({ secret: process.env.SUPABASE_JWT_SECRET! }));

// OR API key auth (from CLI / external)
app.use('/v1/*', apiKeyAuth());
```

## Package Dependencies

```
packages/web
  ├── @dropitx/shared (types, supabase clients)
  └── next, react, tailwindcss, shadcn, codemirror, etc.

packages/api
  ├── @dropitx/shared (types, supabase clients, validation)
  └── hono, @hono/node-server (or @hono/vercel)

packages/shared
  ├── @supabase/supabase-js, @supabase/ssr
  └── nanoid, bcryptjs (shared utilities)

packages/cli
  └── commander (no internal deps — uses REST API)
```

## Environment Variables Strategy

```
# Root .env (development only, loaded by turbo)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# packages/web/.env.local
API_URL=http://localhost:3001  # Hono dev server

# packages/api/.env.local
PORT=3001
```

Vercel: each package gets its own project with env vars configured in Vercel dashboard. `SUPABASE_*` and `UPSTASH_*` vars shared via Vercel shared env vars feature.

## Turborepo Configuration

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "lint": {},
    "type-check": {}
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

## Vercel Deployment

- **packages/web**: Vercel project with `Root Directory: packages/web`
- **packages/api**: Vercel project with `Root Directory: packages/api`, using `@hono/vercel` adapter
- Both projects in same Vercel team, linked to same GitHub repo
- Turborepo remote caching via Vercel (free for Vercel-hosted repos)

## Migration Strategy: Big Bang

Single migration sprint. Each step must leave the repo in a buildable state.

### Step 1: Scaffold monorepo structure
- Init pnpm workspace + turbo.json + tsconfig.base.json
- Create packages/shared with types, supabase clients, utilities
- Create packages/web by moving existing app/, components/, hooks/, public/
- Create packages/api scaffold with Hono entry point

### Step 2: Migrate shared code
- Move types/ → packages/shared/src/types/
- Move utils/supabase/ → packages/shared/src/supabase/
- Move shared lib/ utilities → packages/shared/src/utils/
- Update all imports across packages/web

### Step 3: Rewrite API routes to Hono
- Convert 25 Next.js route handlers to Hono routes
- Implement auth middleware (JWT + API key)
- Implement rate limiting middleware
- Wire up Supabase admin client

### Step 4: Wire web→API communication
- Replace direct Supabase calls in server components with API fetch calls
- Add API_URL env var to packages/web
- Update server actions to call Hono API

### Step 5: Vercel deployment config
- Configure two Vercel projects
- Set up shared env vars
- Test deployment pipeline

### Step 6: Verify and clean up
- Run full test suite
- Verify both auth flows (cookie + API key)
- Verify CLI still works against new API URLs
- Remove dead code from old structure

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Auth regression during migration | High | Test both auth flows (cookie + API key) at each step |
| Supabase SSR cookie handling breaks | High | Cookie auth stays entirely in Next.js middleware — untouched |
| Network latency web→API | Medium | Co-locate on Vercel initially; add caching headers |
| Import path breakage | Medium | TypeScript strict mode + turbo type-check catches all |
| Vercel monorepo build config | Medium | Use Vercel's built-in Turborepo support |
| OG image generation (uses @vercel/og) | Low | Keep in packages/api using @vercel/og — works on Vercel |

## What Stays in packages/web (NOT extracted to API)

- `app/auth/` — OAuth callback handlers (Supabase SSR specific)
- `middleware.ts` — cookie session refresh
- `app/editor/` — client-side CodeMirror (no backend)
- `app/s/[slug]/page.tsx` — SSR share viewer (calls API for data)
- All React components and hooks

## What Moves to packages/api

All 25 route handlers from `app/api/`:
- v1/keys, v1/documents — public REST API
- shares/[slug], shares/[slug]/unlock, shares/[slug]/set-password
- upload, images/upload, publish
- search, analytics/track
- dashboard/teams/*, dashboard/invitations
- invite/accept, invite/decline
- og-image/[slug], oembed

## What Moves to packages/shared

- types/ (4 files: share.ts, team.ts, analytics.ts, team-event.ts)
- utils/supabase/ (browser.ts, server.ts, admin.ts, middleware.ts)
- lib/api-auth.ts — API key validation
- lib/rate-limit.ts — Upstash rate limiting
- lib/nanoid.ts — ID generation
- lib/slug-validation.ts — slug format validation
- lib/extract-text.ts — text extraction utility
- lib/password.ts — bcrypt password hashing

## Success Metrics

1. `pnpm dev` starts both web (port 3000) and API (port 3001)
2. `pnpm build` succeeds with turbo caching
3. All existing features work identically
4. CLI works against new API endpoint
5. Both Vercel projects deploy successfully
6. Cookie auth flow works end-to-end (browser → Next.js → API)
7. API key auth flow works end-to-end (CLI/external → API)

## Next Steps

1. Create detailed implementation plan via `/ck:plan`
2. Execute big-bang migration sprint (~3-5 days)
3. Configure Vercel dual-project deployment
4. Update CLI default API URL configuration
