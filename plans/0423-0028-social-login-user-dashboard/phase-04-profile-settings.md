# Phase 4: Profile Settings Page

## Context Links
- Phase 1: `phase-01-database-auth-config.md` (user_profiles table)
- Phase 3: `phase-03-dashboard-share-history.md` (dashboard layout)

## Overview
- **Priority:** P2
- **Status:** Complete
- Build profile settings page where users can view/edit display name and avatar, see connected accounts (Google/GitHub), and sign out.

## Key Insights
- `user_profiles` stores display_name + avatar_url — editable by user
- Avatar URL comes from OAuth provider automatically (via trigger in Phase 1)
- Connected accounts visible via `supabase.auth.getUser().identities`
- Sign out via `supabase.auth.signOut()` — clears session cookie

## Requirements
### Functional
- Display current avatar, display name, email
- Edit display name (inline save)
- Show connected providers (Google, GitHub) with badges
- Sign out button
- Link/unlink providers (optional, nice-to-have — can defer)

### Non-Functional
- Avatar displays provider image (Google/GitHub URL)
- Form submission with optimistic UI update

## Architecture
```
/dashboard/profile/page.tsx
  ├── Avatar display (provider image URL)
  ├── Display name input + save button
  ├── Connected accounts section (identities)
  └── Sign out button
```

## Related Code Files
### Create
- `app/dashboard/profile/page.tsx` — profile settings page
- `components/profile-form.tsx` — editable profile form (client component)

## Implementation Steps

1. **Create `app/dashboard/profile/page.tsx`:**
   - Server component, fetches user profile from `user_profiles` table
   - Also fetches auth user for email + identities (connected providers)
   - Render `ProfileForm` component with initial data

2. **Create `components/profile-form.tsx`:**
   - Client component
   - Props: initial profile data (display_name, avatar_url, email, identities)
   - Avatar display: `<img>` with provider avatar_url, fallback to initials. URL validated in trigger (https:// only).
   <!-- Updated: Red Team - XSS: render display_name as React JSX text only, never dangerouslySetInnerHTML -->
   - Display name: text input + save button. Always render as React JSX text (auto-escaped).
   - Display name: text input + save button
   - Save: `supabase.from("user_profiles").update({ display_name }).eq("id", userId)`
   - Connected accounts: list identities from user metadata
   - Sign out: `supabase.auth.signOut()` → redirect to `/`

3. **Sign out redirect:** After signOut(), redirect to home page

## Todo List
- [x] Create profile settings page
- [x] Create profile form component
- [x] Implement display name edit + save
- [x] Show connected accounts
- [x] Add sign out button

## Success Criteria
- Profile page shows user's avatar, name, email
- Display name can be edited and persisted
- Connected providers (Google/GitHub) are visible
- Sign out clears session and redirects home

## Risk Assessment
- **Avatar URL:** Provider URLs may expire or change — acceptable for MVP, can add avatar caching later
- **Identity unlinking:** Complex edge cases (can't unlink last provider) — defer to future

## Security Considerations
- RLS ensures users can only update their own profile
- Email from `auth.users` is read-only — not editable through profile page
- Sign out invalidates both access and refresh tokens

## Next Steps
- Phase 5 adds favorites + bookmark toggle
