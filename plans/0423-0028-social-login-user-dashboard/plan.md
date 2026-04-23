---
title: "Social Login + User Dashboard"
description: "Add Google/GitHub OAuth via Supabase Auth, user dashboard with share history, analytics, profile, and favorites/bookmarks."
status: complete
priority: P2
effort: 12h
branch: main
tags: [feature, auth, frontend, database]
blockedBy: []
blocks: []
created: 2026-04-23
---

# Social Login + User Dashboard

## Overview

Add authentication (Google + GitHub OAuth only, no email/password) to the anonymous HTML/MD sharing app. Auth is optional — anonymous uploads remain. Logged-in users get a dashboard with share history, basic analytics, profile settings, and a public bookmark toggle on share pages.

## Cross-Plan Dependencies

None — standalone feature.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Database Migration & Auth Config](./phase-01-database-auth-config.md) | Complete |
| 2 | [Auth Pages & Middleware](./phase-02-auth-pages-middleware.md) | Complete |
| 3 | [Dashboard Layout & Share History](./phase-03-dashboard-share-history.md) | Complete |
| 4 | [Profile Settings Page](./phase-04-profile-settings.md) | Complete |
| 5 | [Favorites & Bookmark Toggle](./phase-05-favorites-bookmark-toggle.md) | Complete |
| 6 | [Header User Menu & Integration](./phase-06-header-user-menu-integration.md) | Complete |

## Dependencies

- Google Cloud Console OAuth credentials (client ID + secret)
- GitHub OAuth App credentials (client ID + secret)
- Supabase dashboard: enable Google + GitHub providers

## Red Team Review

### Session — 2026-04-23
**Findings:** 15 (14 accepted, 1 rejected)
**Severity breakdown:** 3 Critical, 8 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | RLS delete policy breaks anonymous token-based delete | Critical | Accept | Phase 1 |
| 2 | @supabase/auth-ui-react React 19 incompatibility | Critical | Accept | Phase 2 |
| 3 | Open redirect via OAuth callback `next` param | Critical | Accept | Phase 2 |
| 4 | delete_token returned to auth users = bearer backdoor | High | Accept | Phase 1, 3 |
| 5 | Dashboard delete orphans storage objects | High | Accept | Phase 3 |
| 6 | getUser() on admin client returns wrong user | High | Accept | Phase 3 |
| 7 | CSP blocks OAuth form submissions | High | Accept | Phase 2 |
| 8 | Trigger uses wrong metadata key for GitHub | High | Accept | Phase 1 |
| 9 | No ON CONFLICT handling in trigger | High | Accept | Phase 1 |
| 10 | No rollback migration strategy | High | Accept | Phase 1 |
| 11 | Stored XSS via unsanitized display_name | High | Accept | Phase 1, 4 |
| 12 | Phase 6 doesn't know header location | Medium | Accept | Phase 6 |
| 13 | Missing updated_at auto-update trigger | Medium | Accept | Phase 1 |
| 14 | search_shares RPC doesn't filter by user_id | Medium | Accept | Phase 1 |
| 15 | Public profile read enables user enumeration | Medium | Reject | — (by design) |

## Validation Log

### Session — 2026-04-23
**Questions asked:** 3 | **Decisions confirmed:** 3

| # | Question | Decision | Impact |
|---|----------|----------|--------|
| 1 | Should user-owned shares be searchable? | Yes, searchable | No change to search_shares RPC needed |
| 2 | Production data exists? | No, greenfield | Rollback urgency reduced, but still provide down migration |
| 3 | Implement both OAuth providers at once? | Yes, both | Phase 2 unchanged |
