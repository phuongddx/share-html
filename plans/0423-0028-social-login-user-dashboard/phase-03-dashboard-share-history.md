# Phase 3: Dashboard Layout & Share History

## Context Links
- Phase 2: `phase-02-auth-pages-middleware.md`
- Upload API: `app/api/upload/route.ts`
- Share schema: `supabase/schema.sql`

## Overview
- **Priority:** P2
- **Status:** Complete
- Build dashboard shell layout with sidebar navigation, and the share history page showing user's uploaded shares with basic analytics (view count, file size, date) and delete capability.

## Key Insights
- Dashboard is protected by middleware (Phase 2) — guaranteed authenticated
- Shares with `user_id = auth.uid()` belong to current user; NULL user_id shares are anonymous
- Upload API uses `service_role` — need to optionally pass `user_id` from session when user is logged in
- Need server component for data fetching + client component for interactive delete

## Requirements
### Functional
- Dashboard layout with sidebar/tabs linking to: History, Favorites, Profile
- Share history list: slug, filename, title, created_at, view_count, file_size, mime_type
- Delete button per share (confirm dialog)
- Basic stats at top: total shares, total views, storage used

### Non-Functional
- Responsive design
- Matches blue accent theme
- Server-side data fetching for SEO/SSR

## Architecture
```
app/dashboard/
├── layout.tsx         — server component, fetches user, renders sidebar shell
├── page.tsx           — share history (server data fetch + client delete buttons)
├── profile/page.tsx   — Phase 4
└── favorites/page.tsx — Phase 5
```

## Related Code Files
### Modify
- `app/api/upload/route.ts` — optionally set `user_id` from auth session

### Create
- `app/dashboard/layout.tsx` — dashboard shell with nav
- `app/dashboard/page.tsx` — share history list
- `components/dashboard-share-card.tsx` — individual share card with delete

## Implementation Steps

1. **Create `app/dashboard/layout.tsx`:**
   - Server component
   - Fetch user via `createClient(cookies)` → `supabase.auth.getUser()`
   - Sidebar with nav links: History (`/dashboard`), Favorites (`/dashboard/favorites`), Profile (`/dashboard/profile`)
   - Mobile: top nav or hamburger menu
   - Pass user data to children via props or context

2. **Create `app/dashboard/page.tsx`:**
   - Server component, fetches user's shares from Supabase
   - Query: `select * from shares where user_id = auth.uid() order by created_at desc`
   - Calculate aggregate stats (count, total views, total size)
   - Render stats cards at top
   - Render share list with `DashboardShareCard` components

3. **Create `components/dashboard-share-card.tsx`:**
   - Client component for delete functionality
   - Props: share data (slug, filename, title, created_at, view_count, file_size)
   - Shows share link (`/s/{slug}`), formatted date, view count badge
   - Delete button → confirm dialog → call delete API
   - Edit title inline (optional, nice-to-have)

4. **Route dashboard deletes through API endpoint** (NOT direct client-side delete):
   <!-- Updated: Red Team - Client-side delete orphans storage. Must route through API for storage cleanup. -->
   - Create `app/api/shares/[slug]/route.ts` DELETE handler (or extend existing one):
     1. Auth check: verify user is authenticated
     2. Fetch share's `storage_path` and verify `user_id = auth.uid()`
     3. Delete storage object via `supabase.storage.from("html-files").remove([storage_path])`
     4. Delete DB row
   - Use `createAdminClient()` for storage + DB operations (bypasses RLS, same as upload flow)
   - Auth verification via `createClient(cookieStore)` (separate from admin client)
   - Do NOT use `supabase.from("shares").delete()` directly from browser — storage objects would be orphaned

5. **Update `app/api/upload/route.ts`:**
   <!-- Updated: Red Team - Must use TWO clients: anon client for auth check, admin client for storage/insert -->
   - Import `cookies` from `next/headers`, import `createClient` from `@/utils/supabase/server`
   - Create cookie-based client for auth check: `const cookieStore = await cookies(); const authClient = createClient(cookieStore);`
   - Get user: `const { data: { user } } = await authClient.auth.getUser();`
   - Keep using `createAdminClient()` for storage upload + DB insert (bypasses RLS)
   - Pass `user_id: user?.id ?? null` in `shares.insert()` call
   <!-- Updated: Red Team - Auth users should NOT receive delete_token -->
   - Conditional delete_token in response: `deleteToken: user ? "" : deleteToken`

## Todo List
- [x] Create dashboard layout with nav sidebar
- [x] Create share history page with stats
- [x] Create dashboard share card component
- [x] Implement delete functionality (RLS-backed)
- [x] Update upload API to attach user_id

## Success Criteria
- Dashboard loads with user's shares listed
- Stats display correctly (total shares, views, storage)
- Delete removes share and storage object
- Anonymous uploads still work (user_id NULL)
- New uploads by logged-in users show in dashboard

## Risk Assessment
- **user_id on upload:** Must get user from session (anon client), not from admin client — prevents spoofing. TWO clients needed in upload route.
- **Storage cleanup on delete:** Dashboard delete MUST go through API route that handles both storage removal and DB deletion. Direct client-side `shares.delete()` orphans storage files.
- **Empty state:** New users have no shares — show empty state message
<!-- Updated: Red Team - Delete token backdoor -->
- **delete_token for auth users:** Must NOT return delete_token to authenticated uploads. Auth users delete via dashboard only.

## Security Considerations
- RLS ensures users can only delete their own shares
- user_id set server-side from session, not client input
- Storage deletion should also use RLS or service role

## Next Steps
- Phase 4 adds profile settings page
- Phase 5 adds favorites functionality
