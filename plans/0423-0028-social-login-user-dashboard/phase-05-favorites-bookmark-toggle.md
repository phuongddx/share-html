# Phase 5: Favorites & Bookmark Toggle

## Context Links
- Phase 1: `phase-01-database-auth-config.md` (favorites table)
- Share page: `app/s/[slug]/page.tsx`

## Overview
- **Priority:** P2
- **Status:** Complete
- Add public bookmark toggle (heart icon) on share pages and a favorites list in the dashboard.

## Key Insights
- Bookmark toggle appears on ALL share pages — visible to anonymous users too
- Anonymous users clicking bookmark → prompt login (redirect to `/auth/login?next=/s/{slug}`)
- Logged-in users → toggle insert/delete on `favorites` table via browser client
- Need to check if share is already favorited on page load to show filled heart
- RLS on `favorites` table ensures users can only see/modify their own

## Requirements
### Functional
- Heart icon on share pages (`/s/[slug]`)
- Toggle favorite: click → insert/delete
- Show filled heart if already favorited
- Anonymous click → redirect to login with return URL
- `/dashboard/favorites` page: list bookmarked shares with unfavorite button

### Non-Functional
- Instant visual feedback (optimistic UI)
- Heart icon from lucide-react (already installed)

## Architecture
```
app/s/[slug]/page.tsx
  └── BookmarkToggle component
       ├── Check is_favorited on mount
       ├── Click → insert/delete favorites row
       └── Anon click → redirect /auth/login?next=...

app/dashboard/favorites/page.tsx
  └── List of favorited shares
       └── Each with unfavorite button + link to /s/{slug}
```

## Related Code Files
### Modify
- `app/s/[slug]/page.tsx` — add bookmark toggle

### Create
- `components/bookmark-toggle.tsx` — heart icon toggle (client component)
- `app/dashboard/favorites/page.tsx` — favorites list page

## Implementation Steps

1. **Create `components/bookmark-toggle.tsx`:**
   - Client component
   - Props: `shareId: string`, `slug: string`
   - On mount: query `favorites` table for `user_id = auth.uid() AND share_id = shareId`
   - If not logged in → show outline heart, click → redirect to `/auth/login?next=/s/{slug}`
   - If logged in → show filled/outline heart based on favorite status
   - Click: optimistic toggle → `supabase.from("favorites").insert/delete`
   - Use `Heart` icon from lucide-react, filled = `Heart` with fill color, outline = default
   <!-- Updated: Red Team - Prevent race condition on double-click -->
   - Disable button during request (loading state prevents double-click)
   - On error, revert optimistic state and show toast
   - Consider `upsert` or RPC `toggle_favorite(share_id)` for atomic operation instead of separate insert/delete

2. **Modify `app/s/[slug]/page.tsx`:**
   - Import `BookmarkToggle`
   - Place in header area of share page (next to title or as floating action)
   - Pass share's UUID (id) and slug as props

3. **Create `app/dashboard/favorites/page.tsx`:**
   - Server component, fetches user's favorites with joined share data:
     ```sql
     select shares.*, favorites.created_at as favorited_at
     from favorites
     join shares on favorites.share_id = shares.id
     where favorites.user_id = auth.uid()
     order by favorited_at desc
     ```
   - Render list with share card (reuse `DashboardShareCard` or similar)
   - Each item has unfavorite button (uses same logic as `BookmarkToggle`)

## Todo List
- [x] Create bookmark toggle component
- [x] Add bookmark toggle to share pages
- [x] Create dashboard favorites page
- [x] Handle anonymous click → login redirect
- [x] Implement optimistic UI for toggle

## Success Criteria
- Heart icon visible on share pages
- Logged-in users can favorite/unfavorite
- Anonymous users get redirected to login
- Favorites page shows bookmarked shares
- Unfavorite on dashboard removes from list

## Risk Assessment
- **Race condition on toggle:** Double-click could insert twice → UNIQUE constraint handles it (catch error, treat as already favorited)
- **Share UUID needed:** Bookmark toggle needs share `id` (UUID), not just slug — ensure share page passes UUID
- **Expired shares in favorites:** Favorited share may expire → show "expired" state gracefully

## Security Considerations
- RLS on `favorites` table — users can only CRUD their own
- No XSS risk — share IDs are UUIDs, validated by Supabase

## Next Steps
- Phase 6 wires everything into the header
