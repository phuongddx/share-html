# Phase 1: Database Migration & Auth Config

## Context Links
- Brainstorm report: `plans/reports/brainstorm-0423-0028-social-login-user-dashboard.md`
- Existing schema: `supabase/schema.sql`
- Supabase config: `supabase/config.toml`

## Overview
- **Priority:** P1 (blocks all subsequent phases)
- **Status:** Complete
- Migrate database schema (add `user_id` to shares, create `favorites` and `user_profiles` tables) and configure Supabase Auth for Google + GitHub OAuth.

## Key Insights
- `shares.user_id` must be nullable — existing rows have no owner
- `user_profiles` decouples from `auth.users` — editable display name/avatar without touching Supabase's internal table
- RLS policies must preserve public read on shares while restricting owner-only write ops
- Delete token must continue working for anonymous shares — RLS update/delete via service_role bypasses RLS

## Requirements
### Functional
- Add `user_id UUID NULL` and `title VARCHAR(255)` to `shares` table
- Create `favorites` table with user_id + share_id unique constraint
- Create `user_profiles` table referencing `auth.users(id)`
- Enable Google + GitHub OAuth providers in Supabase config

### Non-Functional
- No downtime — all migrations additive (ALTER TABLE ADD COLUMN)
- RLS policies must not break existing anonymous upload flow (service_role bypasses RLS)

## Architecture
```
auth.users (Supabase managed)
    ├── 1:1 ── user_profiles (public.read, owner.write)
    └── 1:N ── shares.user_id (nullable, public.read, owner.write)
                    └── N:M ── favorites (owner-only CRUD)
```

## Related Code Files
### Modify
- `supabase/schema.sql` — add new tables, columns, indexes, RLS policies
- `supabase/config.toml` — enable Google + GitHub external auth providers

### Create
- `supabase/migrations/XXXXXX_add_auth_tables.sql` — migration file

## Implementation Steps

1. **Create migration file** in `supabase/migrations/` with timestamp prefix
2. **ALTER `shares` table:**
   ```sql
   ALTER TABLE shares ADD COLUMN user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;
   ALTER TABLE shares ADD COLUMN title VARCHAR(255);
   CREATE INDEX idx_shares_user_id ON shares(user_id);
   ```
3. **Create `user_profiles` table:**
   ```sql
   CREATE TABLE user_profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     display_name VARCHAR(100),
     avatar_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Public read profiles" ON user_profiles FOR SELECT USING (true);
   CREATE POLICY "Owner update profile" ON user_profiles FOR UPDATE USING (id = auth.uid());
   CREATE POLICY "Owner insert profile" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());
   ```
4. **Create `favorites` table:**
   ```sql
   CREATE TABLE favorites (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(user_id, share_id)
   );
   ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Owner read favorites" ON favorites FOR SELECT USING (user_id = auth.uid());
   CREATE POLICY "Owner insert favorite" ON favorites FOR INSERT WITH CHECK (user_id = auth.uid());
   CREATE POLICY "Owner delete favorite" ON favorites FOR DELETE USING (user_id = auth.uid());
   ```
5. **Add RLS policies for shares owner ops:**
   <!-- Updated: Red Team - RLS delete policy must NOT block existing token-based delete (service_role). Only owner UPDATE/DELETE via anon client. -->
   ```sql
   CREATE POLICY "Owner update share" ON shares FOR UPDATE USING (user_id = auth.uid());
   -- NOTE: Do NOT add a DELETE policy. Existing token-based delete uses createAdminClient() (service_role)
   -- which bypasses RLS. Adding a DELETE policy would block anonymous deletions.
   -- Dashboard deletes go through API route (Phase 3) using createAdminClient(), not direct client.
   ```
6. **Create trigger to auto-create user_profile on signup:**
   <!-- Updated: Red Team - Use COALESCE for GitHub metadata key (name vs full_name), ON CONFLICT for race safety, sanitize display_name -->
   ```sql
   CREATE OR REPLACE FUNCTION handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO user_profiles (id, display_name, avatar_url)
     VALUES (
       NEW.id,
       -- Google uses full_name, GitHub uses name, fallback to user_name
       COALESCE(
         regexp_replace(NEW.raw_user_meta_data->>'full_name', '<[^>]+>', '', 'g'),
         regexp_replace(NEW.raw_user_meta_data->>'name', '<[^>]+>', '', 'g'),
         regexp_replace(NEW.raw_user_meta_data->>'user_name', '<[^>]+>', '', 'g'),
         ''
       ),
       -- Google uses avatar_url, GitHub uses avatar_url (consistent)
       CASE
         WHEN NEW.raw_user_meta_data->>'avatar_url' LIKE 'https://%' THEN NEW.raw_user_meta_data->>'avatar_url'
         WHEN NEW.raw_user_meta_data->>'picture' LIKE 'https://%' THEN NEW.raw_user_meta_data->>'picture'
         ELSE NULL
       END
     )
     ON CONFLICT (id) DO NOTHING;
     RETURN NEW;
   EXCEPTION WHEN OTHERS THEN
     RETURN NEW; -- never block user creation
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION handle_new_user();
   ```
7. **Add `updated_at` auto-update trigger:**
   <!-- Updated: Red Team - moddatetime trigger for user_profiles -->
   ```sql
   CREATE EXTENSION IF NOT EXISTS moddatetime;
   CREATE TRIGGER set_profile_updated_at
     BEFORE UPDATE ON user_profiles
     FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
   ```
8. **Add composite index for dashboard queries:**
   <!-- Updated: Red Team - composite index for user_id + created_at -->
   ```sql
   CREATE INDEX idx_shares_user_created ON shares(user_id, created_at DESC);
   ```
9. **Create rollback migration** in `supabase/migrations/` (companion down file):
   <!-- Updated: Red Team - rollback strategy required -->
   - Drop trigger + function
   - Drop favorites table
   - Drop user_profiles table
   - Drop RLS policies on shares
   - Drop user_id + title columns from shares
10. **Update `supabase/config.toml`:**
   - Enable `[auth.external.google]` with `enabled = true`, `client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"`
   - Enable `[auth.external.github]` with `enabled = true`, `client_id = "env(SUPABASE_AUTH_GITHUB_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_GITHUB_SECRET)"`
11. **Update `.env.example`** (or document) the 4 new env vars needed
12. <!-- Updated: Red Team - Decide delete_token behavior for auth users -->
    **Delete token decision:** Authenticated uploads should NOT return `delete_token` (owners delete via dashboard). Anonymous uploads continue returning `delete_token`. Update upload API: `deleteToken: user ? "" : deleteToken`

## Todo List
- [x] Create migration SQL file
- [x] Add user_id + title columns to shares
- [x] Create user_profiles table with RLS
- [x] Create favorites table with RLS
- [x] Add owner RLS policies to shares
- [x] Create auto-profile trigger on auth.users
- [x] Update config.toml for Google + GitHub providers
- [x] Document required env vars

## Success Criteria
- `supabase db push` runs without errors
- Anonymous shares still work (user_id NULL)
- New OAuth users get auto-created profile row
- RLS allows public read, owner write

## Risk Assessment
- **Migration on existing data:** `user_id` is nullable — no data loss
- **Trigger on auth.users:** Supabase managed table, but `AFTER INSERT` triggers are supported
- **Env vars:** Google/GitHub credentials must be obtained externally before providers work

## Security Considerations
- RLS policies use `auth.uid()` — server-side enforcement, not client-side
- `SECURITY DEFINER` on trigger function needed since `auth.users` is not in public schema
- Service role key still bypasses RLS for upload API — unchanged behavior
- Profile table allows public read for avatar display on share pages — only display_name + avatar_url exposed, no email
<!-- Updated: Red Team - display_name must be rendered as React JSX text (auto-escaped), never dangerouslySetInnerHTML -->
- **XSS prevention:** `display_name` sanitized in trigger (HTML stripped), and must always render via React JSX (auto-escaped). `avatar_url` validated to start with `https://` in trigger. Never use `dangerouslySetInnerHTML` for profile data.

## Next Steps
- Phase 2 builds auth pages on top of this schema
