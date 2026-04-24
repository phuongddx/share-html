# Deployment Guide

## Prerequisites

- Node.js 20+, npm 8+
- Supabase project (hosted or local via CLI)
- Upstash Redis instance
- Vercel account (or compatible hosting)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |

No additional env vars are needed for API key hashing — it uses Node.js built-in `crypto`.

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

**Manual (SQL editor):** Run in this order:
1. `supabase/schema.sql`
2. `supabase/migrations/20260423000001_add_auth_tables.sql`
3. `supabase/migrations/20260424000001_add_editor_columns.sql`
4. `supabase/migrations/20260424000002_add_api_keys.sql`
5. `supabase/migrations/20260424000003_private_search_filter.sql`

**What each migration creates:**

| File | Creates |
|------|---------|
| `schema.sql` | `shares` table, GIN index, `search_shares` + `increment_view_count` RPCs |
| `20260423000001_add_auth_tables.sql` | `user_profiles`, `favorites`, `shares.user_id`, `shares.title` |
| `20260424000001_add_editor_columns.sql` | `shares.source`, `shares.custom_slug`, `shares.is_private`, `shares.updated_at` |
| `20260424000002_add_api_keys.sql` | `api_keys` table + RLS policies |
| `20260424000003_private_search_filter.sql` | Updates `search_shares` RPC to filter private shares by owner |

### 2a. Recovery for Already-Provisioned Projects

If profile reads fail with `PGRST205` / `Could not find the table 'public.user_profiles'`, the auth migration is missing.

1. Apply `supabase/migrations/20260423000001_add_auth_tables.sql`
2. Backfill existing users:

```sql
INSERT INTO public.user_profiles (id, display_name, avatar_url)
SELECT
  u.id,
  NULLIF(LEFT(TRIM(REGEXP_REPLACE(
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name',
             u.raw_user_meta_data->>'user_name', u.raw_user_meta_data->>'preferred_username', ''),
    '<[^>]+>', '', 'g')), 100), '') AS display_name,
  CASE
    WHEN COALESCE(u.raw_user_meta_data->>'avatar_url', '') LIKE 'https://%'
      THEN u.raw_user_meta_data->>'avatar_url'
    WHEN COALESCE(u.raw_user_meta_data->>'picture', '') LIKE 'https://%'
      THEN u.raw_user_meta_data->>'picture'
    ELSE NULL
  END AS avatar_url
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

3. Verify by loading `/dashboard/profile`.

### 3. Storage Bucket

Create `html-files` bucket via Dashboard:
- **Public**: true
- **File size limit**: 50 MB
- **Allowed MIME types**: `text/html`, `text/markdown`, `image/png`, `image/jpeg`, `image/gif`, `image/webp`

No storage policies needed — server uses the `service_role` client which bypasses RLS.

### 4. Get Keys

Dashboard > Settings > API:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon/public** key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

## Upstash Setup

1. Create Redis database at [console.upstash.com](https://console.upstash.com)
2. Copy **REST URL** and **REST Token** to env vars
3. Rate limit config: 10 requests/minute sliding window per IP (`lib/rate-limit.ts`)

## Local Development

```bash
npm install
cp .env.example .env.local  # fill in env vars
npm run dev                  # http://localhost:3000
```

## CLI Tool Setup

The CLI lives in `packages/cli/` and is a separate TypeScript ESM package.

```bash
cd packages/cli
npm install
npm run build          # compiles to dist/
npm link               # makes `share-html` available globally

# Configure with your API key (generated from /dashboard)
share-html login
share-html publish my-file.md -t "My Doc"
share-html list
```

Config is stored at `~/.share-html/config.json` (mode 0600). Never commit this file.

## Vercel Deployment

### CLI

```bash
npx vercel login
npx vercel --prod
```

### Dashboard

1. Import GitHub repo at vercel.com/new
2. Framework preset: Next.js (auto-detected)
3. Add all 5 environment variables in Settings > Environment Variables
4. Deploy

### Build Config

No custom `vercel.json` needed. Next.js 16 is auto-detected.

## Production Checklist

- [ ] All 5 env vars set in Vercel
- [ ] Supabase schema + all 4 migrations applied
- [ ] Storage bucket `html-files` created (public, 50 MB, correct MIME types)
- [ ] Upstash Redis connected
- [ ] `npm run build` passes
- [ ] Upload, view, search, delete flows tested
- [ ] OAuth redirect URLs configured in Supabase Dashboard (Google + GitHub)
- [ ] Editor publish and API key flows tested

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
- **Upstash**: Dashboard for Redis metrics and rate limit hit rates
