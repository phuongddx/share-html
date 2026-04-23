# Phase 6: Header User Menu & Integration

## Context Links
- Phase 2: `phase-02-auth-pages-middleware.md` (auth pages)
- Phase 3: `phase-03-dashboard-share-history.md` (dashboard)
- Home page: `components/home-page.tsx`

## Overview
- **Priority:** P2
- **Status:** Complete
- Add user avatar/dropdown menu to the site header. Logged-in users see avatar + dropdown (Dashboard, Profile, Sign Out). Anonymous users see "Sign In" button. Final integration and polish.

## Key Insights
- Header exists in `home-page.tsx` — need to find where the header/nav is rendered
- User menu is client-side (needs auth state)
- Sign In button links to `/auth/login`
- After sign in, header should show user avatar (from session or profile)

## Requirements
### Functional
- "Sign In" button in header for anonymous users
- Avatar dropdown for logged-in users with: Dashboard, Profile, Sign Out links
- Avatar shows user's profile image or initials fallback
- Mobile responsive (hamburger or icon-only)

### Non-Functional
- Matches blue accent theme
- Smooth dropdown animation
- No layout shift on auth state change

## Architecture
```
Header
├── Logo/brand
├── [Sign In button]           ← anonymous
└── [Avatar dropdown]          ← authenticated
    ├── Dashboard
    ├── Profile
    └── Sign Out
```

## Related Code Files
### Modify
- `components/home-page.tsx` — add auth UI to header (or wherever the site header is defined)

### Create
- `components/auth-user-menu.tsx` — avatar dropdown menu (client component)

## Implementation Steps

1. **Locate the site header** — check `app/layout.tsx` for a global layout. If no global header exists, the auth menu MUST go in `app/layout.tsx` (wraps ALL pages including `/dashboard/*`, `/s/*`), NOT in `components/home-page.tsx` (only renders on home page).
   <!-- Updated: Red Team - Phase 6 originally said "likely in home-page.tsx" which would miss dashboard pages. -->

2. **Create `components/auth-user-menu.tsx`:**
   - Client component
   - Fetch user session on mount: `supabase.auth.getSession()`
   - Listen for auth changes: `supabase.auth.onAuthStateChange()`
   - If no session → render "Sign In" button (link to `/auth/login`)
   - If session → render avatar image + dropdown
   - Dropdown items: Dashboard (`/dashboard`), Profile (`/dashboard/profile`), Sign Out
   - Sign Out: `supabase.auth.signOut()` → `router.push("/")`
   - Use shadcn/ui `DropdownMenu` component if available, or simple CSS dropdown

3. **Integrate into header:**
   - Add `<AuthUserMenu />` to the right side of the header
   - Ensure proper spacing and responsive layout

4. **Final integration checks:**
   - Test full flow: home → sign in → OAuth → dashboard → sign out
   - Test: upload while logged in → appears in dashboard history
   - Test: bookmark share → appears in favorites
   - Test: anonymous upload → does NOT appear in dashboard
   - Test: middleware protects dashboard routes

## Todo List
- [x] Create auth user menu component
- [x] Integrate into site header
- [x] Test full auth flow end-to-end
- [x] Test anonymous vs authenticated upload behavior
- [x] Test bookmark flow end-to-end
- [x] Fix any integration issues

## Success Criteria
- Header shows Sign In / Avatar based on auth state
- Dropdown navigation works (Dashboard, Profile, Sign Out)
- Full auth cycle works: sign in → use features → sign out
- No console errors, no layout shifts

## Risk Assessment
- **Auth state hydration:** Server-rendered header + client auth state → use client component for auth-dependent parts
- **shadcn/ui DropdownMenu:** Check if installed, if not use simple CSS or install it

## Security Considerations
- No sensitive data in dropdown — just navigation links
- Sign out clears session cookies via Supabase

## Next Steps
- All phases complete — ready for deployment
