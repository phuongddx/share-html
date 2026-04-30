# Hostile Plan Review: Invitation Accept UI System

**Reviewer:** code-reviewer (Assumption Destroyer)  
**Plan:** `plans/0429-2136-invite-accept-ui/`  
**Date:** 2026-04-29

---

## Finding 1: Inviter join will fail — FK points to auth.users, not user_profiles

- **Severity:** Critical
- **Location:** Phase 2, section "Create GET /api/dashboard/invitations"
- **Flaw:** The query uses `.select('inviter:user_profiles!team_invites_invited_by_fkey(display_name)')` but the FK `invited_by` references `auth.users(id)`, not `user_profiles(id)`. PostgREST cannot traverse this join path.
- **Failure scenario:** The GET endpoint returns a Supabase error like "Could not find a relationship between 'team_invites' and 'user_profiles' in the schema cache" — every bell fetch fails with 500. The entire notification bell is dead.
- **Evidence:** Migration `20260426000002_teams.sql` line 41: `invited_by UUID NOT NULL REFERENCES auth.users(id)`. There is no FK from `team_invites` to `user_profiles`. The `user_profiles.id` FK is to `auth.users(id)` which means PostgREST sees `team_invites -> auth.users` and `user_profiles -> auth.users` but NOT `team_invites -> user_profiles`.
- **Suggested fix:** Either (a) add an explicit FK from `team_invites.invited_by` to `user_profiles(id)` in a new migration, or (b) query `user_profiles` separately by the `invited_by` UUID in a second query (the plan's own fallback note), or (c) use a Postgres VIEW that joins them.

---

## Finding 2: Radix Popover not installed — plan assumes it exists

- **Severity:** Critical
- **Location:** Phase 3, section "Implementation Steps"
- **Flaw:** Plan states "Radix Popover is already available (via shadcn)" and imports `@radix-ui/react-popover`. But `package.json` only has `@radix-ui/react-dialog` and `@radix-ui/react-select`. No popover package exists.
- **Failure scenario:** Build fails immediately with "Module not found: Can't resolve '@radix-ui/react-popover'". Developer wastes time debugging a "missing dependency" that was supposed to be pre-existing.
- **Evidence:** `package.json` radix entries: `"@radix-ui/react-dialog": "^1.1.15"`, `"@radix-ui/react-select": "^2.2.6"`. No popover.
- **Suggested fix:** Add `npx shadcn@latest add popover` or `npm install @radix-ui/react-popover` to Phase 3 Step 1 alongside SWR installation.

---

## Finding 3: createClient() requires cookieStore argument — plan omits it

- **Severity:** Critical
- **Location:** Phase 2, section "Create GET /api/dashboard/invitations" and "Create POST /api/invite/decline"
- **Flaw:** The plan code shows `const supabase = await createClient();` with no arguments. The actual `createClient` function signature is `createClient(cookieStore: Awaited<ReturnType<typeof cookies>>)` — it requires the cookie store. The existing accept route correctly does `const cookieStore = await cookies(); const supabase = createClient(cookieStore);`.
- **Failure scenario:** TypeScript compilation error. If somehow bypassed, the Supabase client has no auth cookies and `getUser()` always returns null — every request is 401.
- **Evidence:** `utils/supabase/server.ts` line 6: `export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {`. Compare with plan Phase 2 code: `const supabase = await createClient();`
- **Suggested fix:** Match existing pattern from `/api/invite/accept/route.ts`: `const cookieStore = await cookies(); const supabase = createClient(cookieStore);`

---

## Finding 4: Signup page does not exist — plan acknowledges but proceeds anyway

- **Severity:** High
- **Location:** Phase 4, section "Check /auth/signup page exists" (Step 5)
- **Flaw:** The filesystem shows no `/app/auth/signup` directory. The plan says "Verify and adjust URL accordingly" but still generates code that hardcodes `/auth/signup?next=...`. An implementer following Phase 4 literally will ship a broken link.
- **Failure scenario:** User clicks "Sign Up to Accept" and gets a 404 page. They cannot complete the invite flow. This is a primary user path for NEW users — the exact people you want to onboard.
- **Evidence:** `find` on `app/auth` shows: `callback/route.ts`, `confirm/route.ts`, `login/page.tsx`, `reset-password/page.tsx`, `update-password/page.tsx`. No signup.
- **Suggested fix:** Phase 4 must either (a) create the signup page as a prerequisite task, or (b) route to `/auth/login` with a query param like `?mode=signup&next=...` if the login page supports a signup tab, or (c) explicitly block Phase 4 until a signup page exists.

---

## Finding 5: URL parameter parsing ambiguity in auto-accept redirect

- **Severity:** High
- **Location:** Phase 4, section "Update page.tsx — auto_accept param handling"
- **Flaw:** The plan constructs: `/auth/login?next=/invite/accept?token=xxx&auto_accept=true`. When the browser parses this URL, `auto_accept=true` is a parameter of `/auth/login`, NOT part of the `next` value. The `next` param gets truncated to `/invite/accept?token=xxx`.
- **Failure scenario:** After OAuth callback, user is redirected to `/invite/accept?token=xxx` WITHOUT `auto_accept=true`. The form renders but does NOT auto-fire. User must click "Accept" manually — silent functionality loss that nobody notices during development (because manual click still works).
- **Evidence:** Plan code: `const loginUrl = '/auth/login?next=${encodeURIComponent('/invite/accept?token=${token}&auto_accept=true')}';`. Wait — the plan DOES use `encodeURIComponent`. Let me re-read... Yes, the plan encodes the entire next value. The plan text in the overview however says "Uses URL: /auth/login?next=/invite/accept?token=xxx&auto_accept=true" without encoding, creating confusion for implementers reading the overview vs the code.
- **Failure scenario (revised):** If an implementer reads the overview description (not the code block) and constructs the URL without encoding, auto_accept is lost. Additionally: the auth callback does `searchParams.get("next")` on the callback URL, which is a DIFFERENT URL than the login URL. The login page must forward `next` to Supabase's OAuth redirect URL, and Supabase must preserve it through the OAuth flow back to `/auth/callback?code=...&next=...`. Is this verified?
- **Suggested fix:** Trace the full redirect chain end-to-end: login page -> OAuth provider -> /auth/callback -> next. Verify the login page actually passes `next` through the OAuth state parameter. If it uses `redirectTo` in Supabase auth, confirm the value arrives intact at callback.

---

## Finding 6: SWR fetcher fires for unauthenticated users hitting /api/dashboard/invitations

- **Severity:** High
- **Location:** Phase 3, section "Data fetching" and "Risk Assessment"
- **Flaw:** The plan says "Only render when `useAuthUser()` returns a user" — but `useAuthUser()` is async/state-based. On initial render, user state may be `null` (loading). If the component conditionally renders based on user, there's a flash. If SWR hook is called unconditionally (React hooks rules), the fetch fires before auth state resolves.
- **Failure scenario:** First render: `useAuthUser()` returns null. Component returns null (not rendered). But wait — if the SWR hook is inside the component, it MUST be called on every render (Rules of Hooks). So either: (a) SWR is called but component returns null — fetch fires, gets 401, SWR caches error, then on next render when user loads, SWR serves stale error. (b) Component is never mounted until auth resolves (parent gates it) — fine, but plan doesn't specify this parent-level gating.
- **Evidence:** Plan Risk Assessment says "Bell flickers on unauthenticated pages" with mitigation "Only render when `useAuthUser()` returns a user" — but doesn't specify WHERE this gating happens. The mount point is `header-bar.tsx` which renders on all pages.
- **Suggested fix:** Either (a) use SWR's conditional fetching: `useSWR(user ? "/api/dashboard/invitations" : null, fetcher)` so it doesn't fire without auth, or (b) explicitly gate at the parent level in `header-bar.tsx` with `{user && <InviteNotificationBell />}`.

---

## Finding 7: Token exposed in GET response — information leak via client-side cache

- **Severity:** High
- **Location:** Phase 2, section "Create GET /api/dashboard/invitations"
- **Flaw:** The GET endpoint returns `token` in the response payload. This token is the cryptographic secret that authorizes accept/decline actions. It gets stored in SWR's in-memory cache (and potentially browser devtools network tab, service worker caches, etc.). Any XSS on the page can extract all pending invite tokens.
- **Failure scenario:** A single XSS vulnerability (even a reflected one on any page with the header) lets an attacker harvest all pending invite tokens from the SWR cache and accept invites on behalf of the user, joining teams they shouldn't have access to.
- **Evidence:** Phase 2 response mapping includes `token: inv.token`. Phase 3 handlers use this token for accept/decline.
- **Suggested fix:** Acceptable tradeoff if the team acknowledges it. Alternative: return invite `id` only, and have the accept/decline endpoints look up the token server-side via admin client using the invite id + email match. This way tokens never leave the server.

---

## Finding 8: 200-line budget unrealistic for Phase 3 bell component

- **Severity:** Medium
- **Location:** Phase 3, section "Success Criteria"
- **Flaw:** The component must contain: SWR setup, Popover trigger+content, invite card sub-component (with team name, inviter, role, time-ago, two buttons), accept handler (fetch + toast + mutate + redirect), decline handler (fetch + toast + mutate), loading state management, empty state, badge rendering, relative time formatting, proper TypeScript interfaces. That's easily 250-300 lines.
- **Failure scenario:** Implementer either (a) crams everything in and produces unreadable code, (b) splits into multiple files which contradicts the plan ("Inline within the bell file"), or (c) cuts features to fit the budget.
- **Evidence:** Plan says "keep under 200 lines total" and "Inline within the bell file" for the card sub-component.
- **Suggested fix:** Either raise budget to 250-300 lines, or explicitly allow extraction of `InviteCard` into a sibling file, or remove the relative time formatter (use raw date).

---

## Finding 9: Race condition in auto-accept useEffect with missing dependency

- **Severity:** Medium
- **Location:** Phase 4, section "Update invite-accept-form.tsx — auto-accept on mount"
- **Flaw:** The `useEffect` has `[autoAccept]` as dependency array but calls `handleAccept()` which is a closure over `token`, `router`, and state setters. If `token` changes (URL rewrite, React Suspense replay), the stale closure fires with the old token. Additionally, React's exhaustive-deps lint rule will flag `handleAccept` as a missing dependency.
- **Failure scenario:** ESLint rule `react-hooks/exhaustive-deps` fires a warning. More concerning: in concurrent React, if the component suspends and re-renders with different props, the ref guard prevents the correct token from being used.
- **Evidence:** Plan code: `useEffect(() => { if (autoAccept && !hasAutoAccepted.current) { hasAutoAccepted.current = true; handleAccept(); } }, [autoAccept]);`
- **Suggested fix:** Use `useCallback` for `handleAccept` with proper deps, or inline the fetch logic directly in the effect with the token from props as a dep: `[autoAccept, token]`.

---

## Finding 10: No error handling for malformed JSON body in POST /api/invite/decline

- **Severity:** Medium
- **Location:** Phase 2, section "Create POST /api/invite/decline"
- **Flaw:** `await request.json()` throws if the body is not valid JSON (empty body, malformed, wrong content-type). The plan's code has no try/catch around it. The existing `/api/invite/accept` route DOES have a top-level try/catch, but the decline route plan does not.
- **Failure scenario:** A client sends a request with no body or `Content-Type: text/plain`. The route throws an unhandled exception, returns a generic 500 with potentially a stack trace in dev mode, and logs noise.
- **Evidence:** Phase 2 decline route code starts with `const body = await request.json()` without any surrounding try/catch. Compare to accept route which wraps everything in `try { ... } catch (err) { ... }`.
- **Suggested fix:** Wrap the entire handler in try/catch like the accept route pattern, or at minimum wrap `request.json()` and return 400 on parse failure.

---

## Summary

| Severity | Count | Findings |
|----------|-------|----------|
| Critical | 3 | #1 (FK join impossible), #2 (Popover not installed), #3 (createClient signature wrong) |
| High | 4 | #4 (signup page missing), #5 (redirect chain unverified), #6 (SWR fires without auth), #7 (token exposure) |
| Medium | 3 | #8 (200-line budget), #9 (useEffect deps), #10 (no JSON error handling) |

**Blocking assessment:** Findings #1, #2, and #3 will cause immediate build or runtime failures. These must be resolved before implementation begins.
