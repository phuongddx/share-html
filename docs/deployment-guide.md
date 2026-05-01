# DropItX Vercel Deployment Guide (Monorepo)

This guide explains how to deploy DropItX as a Turborepo monorepo with two separate Vercel projects (web + API).

## Architecture

```
Vercel Dashboard
├── dropitx-web (project)
│   ├── Root Directory: packages/web
│   ├── Framework: Next.js
│   ├── Build Command: cd ../.. && pnpm turbo build --filter=@dropitx/web
│   └── Domain: dropitx.vercel.app (or custom)
├── dropitx-api (project)
│   ├── Root Directory: packages/api
│   ├── Framework: Other
│   ├── Build Command: cd ../.. && pnpm turbo build --filter=@dropitx/api
│   └── Domain: api.dropitx.vercel.app (or custom)
└── Shared
    ├── Git repo: same GitHub repo
    ├── Turborepo remote cache: enabled (automatic)
    └── Shared env vars via Vercel team settings
```

## Prerequisites

- Node.js 20+, pnpm 8+
- Supabase project (hosted or local via CLI)
- Vercel account (or compatible hosting)
- GitHub repository with monorepo structure

## Environment Variables

### dropitx-web Project

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key (may be named `PUBLISHABLE_KEY` in newer Supabase) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `API_URL` | Yes | API base URL for server-side calls: `https://api.dropitx.vercel.app` |

**Important:** Do NOT set `NEXT_PUBLIC_API_URL`. Client components use relative paths (`/api/...`) which are proxied by Next.js rewrites to the Hono API.

### dropitx-api Project

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL (same as web) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (same as web) |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret from Supabase dashboard (Settings → API → JWT Secret) |
| `CORS_ORIGIN` | Yes | Must be set explicitly: `https://dropitx.vercel.app` (never use `*`) |

**Note:** No Upstash variables needed. Rate limiting uses Postgres RPC functions.

## Supabase Setup

### 1. Create Project

Via [Supabase Dashboard](https://app.supabase.com) or CLI:

```bash
supabase login
supabase init
```

### 2. Apply Schema and Migrations

`supabase/schema.sql` contains the base shares table only. Auth/dashboard/editor/API-key tables live in `supabase/migrations/`.

**Recommended (CLI):**

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Manual (SQL editor):** Run migrations in timestamp order from `supabase/migrations/` directory.

### 3. Storage Bucket

Create `html-files` bucket via Dashboard:
- **Public**: true
- **File size limit**: 50 MB
- **Allowed MIME types**: `text/html`, `text/markdown`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`

No storage policies needed — server uses the `service_role` client which bypasses RLS.

### 4. Get Keys

Dashboard > Settings > API:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
- **anon/public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
- **JWT Secret** → `SUPABASE_JWT_SECRET` (API project only)

## Initial Deployment Setup

### Step 1: Deploy API Project (Do This First)

The API has no dependencies on the web app, so deploy it first:

```bash
# Navigate to API package
cd packages/api

# Link to Vercel project (create new if needed)
vercel link

# Deploy to production
vercel --prod
```

**Vercel Project Settings for API:**
- **Root Directory:** `packages/api`
- **Framework Preset:** Other
- **Build Command:** `cd ../.. && pnpm turbo build --filter=@dropitx/api`
- **Output Directory:** `dist`
- **Install Command:** `pnpm install` (default from root package.json)

**Set Environment Variables on API Project:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `CORS_ORIGIN` = `https://dropitx.vercel.app`

### Step 2: Deploy Web Project

After the API is live, deploy the web app:

```bash
# Navigate to web package
cd packages/web

# Link to Vercel project (or update existing)
vercel link

# Deploy to production
vercel --prod
```

**Vercel Project Settings for Web:**
- **Root Directory:** `packages/web`
- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** `cd ../.. && pnpm turbo build --filter=@dropitx/web`
- **Install Command:** `pnpm install` (default from root package.json)

**Set Environment Variables on Web Project:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_URL` = `https://api.dropitx.vercel.app`

## URL Routing Strategy

### Client Components (Browser)
- Use relative paths: `/api/v1/documents`, `/api/shares/[slug]`, etc.
- Next.js rewrites proxy these to `https://api.dropitx.vercel.app`
- No CORS issues (same origin)
- No exposed API URLs in client bundle

### Server Components (Next.js Server)
- Use `API_URL` environment variable for server-side calls
- Direct HTTP requests to Hono API via apiClient
- Bypass Next.js rewrites for better performance

### Direct API Access (CLI, Mobile Apps, External Services)
- Use `https://api.dropitx.vercel.app` directly
- CORS is configured for `CORS_ORIGIN` domain
- Requires API key authentication via `Authorization` header

## Local Development

```bash
# Install dependencies (from root)
pnpm install

# Start both API and web in parallel
pnpm dev

# Or start individually:
pnpm --filter @dropitx/api dev  # API on http://localhost:8787
pnpm --filter @dropitx/web dev  # Web on http://localhost:3000
```

## CLI Tool Setup

The CLI lives in `packages/cli/` and is a separate TypeScript ESM package.

```bash
cd packages/cli
pnpm install
pnpm run build          # compiles to dist/
pnpm link               # makes `dropitx` available globally

# Configure with your API key (generated from /dashboard)
dropitx login
dropitx publish my-file.md -t "My Doc"
dropitx publish my-file.md -t "My Doc" -P password  # with password protection
dropitx list
```

Config is stored at `~/.dropitx/config.json` (mode 0600). Never commit this file.

## Verification Steps

After deployment, verify both projects:

### 1. API Health Check
```bash
curl https://api.dropitx.vercel.app/health
# Expected: {"status":"ok"} or similar health response
```

### 2. Web App Home Page
```bash
curl https://dropitx.vercel.app
# Expected: HTML response with DropItX UI
```

### 3. End-to-End Flows
- [ ] OAuth login flow works (GitHub/Google callback → dashboard)
- [ ] File upload works (create document → upload file → publish)
- [ ] Share viewer works (public + password-protected shares)
- [ ] Team invitation flow works (send invite → accept → member added)
- [ ] CLI works against new API URL (`dropitx --api-url https://api.dropitx.vercel.app ...`)

### 4. Server-Side Rendering
- [ ] Dashboard pages render correctly (SSR)
- [ ] Share viewer pages render correctly (SSR + ISR)
- [ ] Search functionality works (API calls from server components)

## Turborepo Remote Caching

Vercel automatically enables remote caching for Turborepo repositories. This means:

- Build artifacts are cached across deployments
- Subsequent builds are faster (only changed packages are rebuilt)
- No manual configuration required

To verify remote caching is active:
```bash
pnpm turbo build --filter=@dropitx/web --dry
```

Look for cache status indicators in the output.

## Git Workflow

Both projects are connected to the same GitHub repository. When you push to the main branch:

1. Vercel detects the push
2. Both projects build in parallel (if both changed)
3. API deploys first (no dependencies)
4. Web app deploys second (depends on API URL)
5. Zero-downtime deployments (Vercel handles traffic shifting)

## Troubleshooting

### Build Failures

**Error:** "No package found with name 'web'"
- **Solution:** Use full package name: `--filter=@dropitx/web`

**Error:** "Cannot find module '@dropitx/shared'"
- **Solution:** Ensure `pnpm install` runs in root directory before build

**Error:** "Supabase JWT verification failed"
- **Solution:** Verify `SUPABASE_JWT_SECRET` matches exactly between web and API projects

### Runtime Errors

**Error:** "CORS origin not allowed"
- **Solution:** Set `CORS_ORIGIN` env var on API project to exact web URL (no trailing slash)

**Error:** "API_URL is not defined"
- **Solution:** Add `API_URL` env var to web project (server-side only, no `NEXT_PUBLIC_` prefix)

**Error:** "Next.js rewrites not working"
- **Solution:** Ensure `next.config.ts` has rewrites configured and middleware matcher doesn't intercept `/api/*` paths

### Performance Issues

**Issue:** Slow cold starts on API
- **Solution:** Hono is lightweight (~14KB), but consider adding `maxDuration` to vercel.json if needed:
  ```json
  {
    "functions": {
      "api/*.js": {
        "maxDuration": 10
      }
    }
  }
  ```

**Issue:** Build times are long
- **Solution:** Verify Turborepo remote caching is active in Vercel dashboard

## Production Checklist

- [ ] All env vars set on both Vercel projects
- [ ] Supabase schema + all migrations applied
- [ ] Storage bucket `html-files` created (public, 50 MB, correct MIME types)
- [ ] `pnpm turbo build` passes for both packages
- [ ] API health check returns 200
- [ ] Web app loads correctly
- [ ] Upload, view, search, delete flows tested
- [ ] OAuth redirect URLs configured in Supabase Dashboard (Google + GitHub)
- [ ] Editor publish and API key flows tested
- [ ] Password protection and team workspace flows tested
- [ ] Team invite system tested (single invite, bulk invite, resend, accept flow)
- [ ] Email authentication flows tested (signup, login, reset, confirmation)
- [ ] oEmbed embedding and analytics dashboard functional
- [ ] CLI works with new API URL
- [ ] Turborepo remote caching is active

## Maintenance

### Expired Share Cleanup

No automatic cleanup. Manual process:

```sql
-- 1. Identify expired shares
SELECT id, storage_path FROM shares WHERE expires_at < NOW();

-- 2. Delete storage objects (via Supabase Dashboard or Storage API)

-- 3. Delete database records
DELETE FROM shares WHERE expires_at < NOW();
```

Consider automating via Supabase Edge Function or `pg_cron`.

### Monitoring

- **Vercel**: Built-in analytics, function logs, error tracking
- **Supabase**: Dashboard for DB stats, storage usage, query performance
- **Rate limiting**: Built-in via Postgres RPC (check `supabase/migrations/20260425045621_rate-limits-supabase.sql`)

## Migration from Single-App Deployment

If migrating from a single-app deployment:

1. **Deploy API first** to new Vercel project
2. **Update DNS/custom domains** to point to new projects
3. **Deploy web app** with API rewrites configured
4. **Test all flows** before deleting old project
5. **Update CLI** to use new API URL
6. **Delete old Vercel project** after verification

## Security Checklist

- [ ] `API_URL` is NOT prefixed with `NEXT_PUBLIC_` (server-side only)
- [ ] `CORS_ORIGIN` is set to specific domain, never `*`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client
- [ ] `SUPABASE_JWT_SECRET` matches exactly between projects
- [ ] No hardcoded credentials in code
- [ ] Rate limiting is enabled via Postgres RPC
- [ ] API key authentication is enforced for `/api/v1/*` routes
- [ ] OAuth redirect URLs are updated in Supabase settings

## Cost Considerations

- **Hobby Plan:** Both projects fit in free tier (if under limits)
- **Pro Plan:** Recommended for production (higher limits, team features)
- **Database:** Supabase costs are separate (not included in Vercel pricing)

## Next Steps

After initial deployment:
1. Set up custom domains (optional)
2. Configure automatic previews for pull requests
3. Set up error tracking (Sentry, LogRocket)
4. Set up uptime monitoring (Pingdom, UptimeRobot)
5. Document runbook for incident response
6. Train team on monorepo workflow

## Support

For issues specific to:
- **Vercel deployment:** https://vercel.com/docs
- **Turborepo:** https://turbo.build/repo/docs
- **Hono:** https://hono.dev/docs
- **Next.js:** https://nextjs.org/docs
- **DropItX:** Check `./docs` directory or open GitHub issue
