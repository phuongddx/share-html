# Security Adversary Plan Review: Invite Accept UI

**Reviewer:** code-reviewer (Security Adversary perspective)
**Date:** 2026-04-29
**Scope:** Plan for decline RPC, invitations API, notification bell, auto-signup accept flow

---

## Finding 1: GET /api/dashboard/invitations leaks invite TOKEN to the client

- **Severity:** Critical
- **Location:** Phase 2, section "GET /api/dashboard/invitations" response shape
- **Flaw:** The plan explicitly returns the invite `TOKEN` in the API response payload: `"Returns: id, role, TOKEN, created_at, expires_at, team_name, team_slug, inviter_name"`. The token is a 64-char hex secret that authorizes team membership. Sending it to the browser means any XSS vulnerability, browser extension, or compromised CDN script can harvest invite tokens and accept invitations on behalf of arbitrary users.
- **Failure scenario:** Attacker injects a script via XSS (the CSP allows `'unsafe-inline' 'unsafe-eval'` on script-src). The script fetches `GET /api/dashboard/invitations`, reads all pending invite tokens, and POSTs them to `POST /api/invite/accept` — joining teams the attacker was never invited to, or forwards them to an external server for later use. Even without XSS, browser devtools, Sentry breadcrumbs, or logging middleware could capture the token.
- **Evidence:** Plan states returns include `TOKEN` field. The token is the sole bearer credential for `accept_team_invite` and `decline_team_invite` RPCs.
- **Suggested fix:** Never return the raw token to the client. Return only the invite `id`. The decline and accept endpoints should accept `invite_id` and verify ownership server-side (email match + auth), or use a derived HMAC of the token that cannot be used to accept the invite directly. If the bell must link to the accept page, construct the URL server-side or use a short-lived signed redirect.

---

## Finding 2: Open redirect via auto_accept redirect chain

- **Severity:** Critical
- **Location:** Phase 4, section "Redirect URL"
- **Flaw:** The plan specifies redirect URL: `/auth/login?next=/invite/accept?token=xxx&auto_accept=true`. The `next` parameter value is `/invite/accept?token=xxx&auto_accept=true`. In the auth callback (`/auth/callback/route.ts`), the code does: `const rawNext = searchParams.get("next") ?? "/dashboard"` followed by `return NextResponse.redirect(origin + next)`. When the URL is `/auth/callback?code=...&next=/invite/accept?token=xxx&auto_accept=true`, `searchParams.get("next")` returns `/invite/accept?token=xxx` because `&auto_accept=true` becomes a separate query param of the callback URL, NOT part of `next`. The `auto_accept` param is lost in transit.
- **Failure scenario:** User clicks "Sign Up to Accept", authenticates, gets redirected to `/invite/accept?token=xxx` without `auto_accept=true`. The auto-accept `useEffect` never fires. User must manually click accept. Worse: if the plan's implementer "fixes" this by not URL-encoding the `next` param or by relaxing the open-redirect protection, they introduce an actual open redirect.
- **Evidence:** Plan says: `Redirect URL: /auth/login?next=/invite/accept?token=xxx&auto_accept=true`. The `next` value contains unencoded `&` which splits at the callback URL boundary. Existing callback code: `const rawNext = searchParams.get("next")`.
- **Suggested fix:** The `next` value MUST be fully URL-encoded: `/auth/login?next=%2Finvite%2Faccept%3Ftoken%3Dxxx%26auto_accept%3Dtrue`. The plan should specify this explicitly. Also note: the existing login page's `isValidRedirect` only allows paths starting with `/s/` — the invite accept path `/invite/accept` will be REJECTED by the current login page OAuth flow. The login page must be updated to also allow `/invite/accept` paths, or the entire flow breaks silently.

---

## Finding 3: Login page `isValidRedirect` rejects invite accept paths

- **Severity:** Critical
- **Location:** Phase 4, section "After auth callback"
- **Flaw:** The existing login page (`app/auth/login/page.tsx`) has `isValidRedirect` that only returns true for paths starting with `/s/`. The invite accept redirect path `/invite/accept?token=xxx&auto_accept=true` does NOT start with `/s/`. Therefore `isShareRedirect` is false, and the OAuth `redirectTo` URL will NOT include the `next` parameter. After OAuth callback, user lands on `/dashboard` instead of the invite accept page. The entire auto-signup accept flow is dead on arrival.
- **Failure scenario:** New user clicks "Sign Up to Accept" link, logs in via Google/GitHub OAuth, ends up at `/dashboard` with no indication the invite exists. The invite sits in pending state until it expires. User never joins the team.
- **Evidence:** `login/page.tsx` line 9-11: `function isValidRedirect(path: string | null): boolean { if (!path) return false; return path.startsWith("/s/") && !path.includes("//") && !path.includes("\\"); }`. Line 33-36: `const redirectTo = (() => { const callbackUrl = new URL("/auth/callback", window.location.origin); if (isShareRedirect && nextPath) { callbackUrl.searchParams.set("next", nextPath); } ... })()`. The `next` param is only forwarded for `/s/` paths.
- **Suggested fix:** The plan must explicitly call out updating `isValidRedirect` to also accept `/invite/accept` paths. Something like: `return (path.startsWith("/s/") || path.startsWith("/invite/accept")) && !path.includes("//") && !path.includes("\\")`. Without this, Phase 4 cannot function.

---

## Finding 4: decline_team_invite RPC lacks authorization — any user can decline anyone's invite

- **Severity:** High
- **Location:** Phase 1, section "decline_team_invite RPC"
- **Flaw:** The plan says the RPC takes `p_token TEXT, p_user_email TEXT` and uses `auth.uid()` guard plus email matching. However, the `p_user_email` is a parameter passed BY THE CALLER. The existing `accept_team_invite` RPC has the same pattern — it trusts `p_user_email` from the API route where `user.email` is read from the auth session. But the decline plan says "Checks status pending, expiry, email match (LOWER/TRIM)" — this is fine IF the email comes from the session. The risk is that if the API route passes `p_user_email` from the request body instead of the session, any authenticated user could decline any invite by supplying the target email.
- **Failure scenario:** Attacker authenticates as `attacker@evil.com`, calls `POST /api/invite/decline` with `{ token: "known-token", email: "victim@company.com" }`. If the route passes the body email to the RPC, the invite is declined. The victim never sees the invite.
- **Evidence:** Plan Phase 2 for POST /api/invite/decline says: "Takes { token } from body" and "Calls decline_team_invite RPC with user.email". The plan says `user.email` from session, which is correct. But the plan does NOT explicitly state "MUST NOT accept email from the request body". Given the RPC signature takes `p_user_email` as a parameter, the implementation must be crystal clear about this.
- **Suggested fix:** The plan should explicitly state: "The user email MUST come from `supabase.auth.getUser()`, never from the request body. The RPC should ideally derive the email from `auth.uid()` internally rather than accepting it as a parameter, to eliminate the trust boundary entirely." Better: modify the RPC to look up the email from `auth.users` table using `auth.uid()` inside the function, removing the parameter.

---

## Finding 5: Admin client bypasses RLS in GET invitations — no row-level authorization

- **Severity:** High
- **Location:** Phase 2, section "GET /api/dashboard/invitations"
- **Flaw:** The plan says "Uses ADMIN CLIENT (bypasses RLS) to query team_invites" with filter `email = user.email.toLowerCase()`. The ADMIN CLIENT is a service-role client that bypasses all RLS policies. The only authorization is the email filter in the application code. If there is any bug in the email normalization (e.g., the route uses `user.email` without `.toLowerCase()` while the DB stores lowercase, or vice versa), the query returns zero results or wrong results. More critically, the admin client pattern means any code change or typo in the filter silently removes all authorization.
- **Failure scenario:** Developer refactors the query and accidentally removes or changes the email filter. Since RLS is bypassed, the endpoint returns ALL pending invites across ALL teams for ALL users. This leaks team names, inviter names, roles, and (per Finding 1) tokens.
- **Evidence:** Plan states: "Auth via supabase.auth.getUser()" and "Uses ADMIN CLIENT (bypasses RLS)". The admin client is `createAdminClient()` which uses the service role key. There are existing RLS policies on `team_invites` that could be used instead, but the plan bypasses them.
- **Suggested fix:** Use the authenticated user's Supabase client (anon key + session cookie) instead of the admin client. Add a new RLS SELECT policy on `team_invites` that allows `WHERE email = LOWER((SELECT auth.email()))` for the invitee to read their own invites. This provides defense-in-depth — even if application code has a bug, RLS prevents data leakage.

---

## Finding 6: Notification bell polls with revalidateOnFocus but no rate limiting on GET endpoint

- **Severity:** High
- **Location:** Phase 3, section "Radix Popover" / Phase 2, section "GET /api/dashboard/invitations"
- **Flaw:** The plan specifies `revalidateOnFocus: true` for the SWR fetch of `GET /api/dashboard/invitations`. This means every tab focus triggers a request. Combined with no rate limiting on the GET endpoint (the plan does not mention any), a user with many tabs or rapid alt-tabbing generates unbounded requests. Each request uses the admin client which creates a new Supabase service-role connection — no connection pooling mentioned.
- **Failure scenario:** Power user with 20 tabs open, or attacker scripting rapid focus/blur events, generates hundreds of admin-client queries per minute. The endpoint joins `team_invites`, `teams`, and `user_profiles` — three tables per request with no caching layer. This degrades database performance for all users.
- **Evidence:** Plan Phase 3: `revalidateOnFocus: true`. Plan Phase 2: no mention of rate limiting, caching headers, or stale-while-revalidate server-side strategy.
- **Suggested fix:** Add `Cache-Control: private, max-age=30` headers on the GET response. Use `dedupingInterval` in SWR config (e.g., 30s). Consider using the user's anon client instead of admin client to leverage Supabase's connection pooling. Add API-level rate limiting (e.g., 10 req/min per user).

---

## Finding 7: Error message keyword matching is fragile and leaks internal state

- **Severity:** Medium
- **Location:** Phase 2, section "POST /api/invite/decline — Error mapping"
- **Flaw:** The plan says error mapping uses "keyword matching on error.message". This is the same pattern used in the existing accept route (`msg.includes("not found")`, `msg.includes("already accepted")`, etc.). PostgreSQL error messages are not part of any stable API — they can change with locale settings, Supabase version upgrades, or even minor SQL refactors. A message change silently turns a 404 into a 500, confusing clients. Additionally, the raw `error.message` from Supabase RPCs can contain internal details like table names, constraint names, or even query fragments.
- **Failure scenario:** Supabase upgrades Postgres from 15.x to 16.x. An exception message changes from "Invite not found" to "No matching row in team_invites". The keyword "not found" no longer matches. The endpoint returns 500 + raw error message containing "team_invites" table name, leaking schema information.
- **Evidence:** Existing accept route at `/api/invite/accept/route.ts` line 31-42 already uses this pattern. Plan Phase 2 replicates it for decline.
- **Suggested fix:** Use PostgreSQL error codes (SQLSTATE) via `RAISE EXCEPTION ... USING ERRCODE = 'P0001'` with custom error detail, or return structured error data from the RPC (e.g., return a `declined BOOLEAN, error_code TEXT` instead of raising exceptions). Never forward raw `error.message` to the client.

---

## Finding 8: Auto-accept useEffect + useRef guard has a race condition with React StrictMode

- **Severity:** Medium
- **Location:** Phase 4, section "InviteAcceptForm fires accept on mount via useEffect + useRef guard"
- **Flaw:** The plan specifies using `useEffect` + `useRef` guard for auto-accept on mount. In React 18 StrictMode (which Next.js uses in development), effects run twice. The `useRef` guard prevents double-fire in dev, but the plan does not address what happens if the first POST succeeds and the component re-renders before the redirect. The accept RPC uses `FOR UPDATE` locking so the second call would see `status = 'accepted'` and return an error, which the UI would briefly display as an error flash before redirect.
- **Failure scenario:** In production with concurrent React transitions (e.g., Suspense boundary triggers re-mount), the accept fires, succeeds, redirect starts, but a concurrent re-mount fires accept again. Second call fails with "already accepted" (410). User sees a flash of error text before navigation completes. Not a data corruption issue but a confusing UX and unnecessary server load.
- **Evidence:** Plan says: "InviteAcceptForm fires accept on mount via useEffect + useRef guard". React StrictMode double-mount is documented behavior. The existing `invite-accept-form.tsx` does NOT auto-fire on mount — it requires a button click. The plan is adding new auto-fire behavior.
- **Suggested fix:** In addition to `useRef` guard, the auto-accept should: (1) check if the component is still mounted before setting state, (2) treat "already accepted" as a success case and redirect normally, (3) use an AbortController to cancel the fetch on unmount.

---

## Finding 9: Token exposed in URL throughout the entire flow

- **Severity:** Medium
- **Location:** Phase 4, section "Redirect URL" and Phase 3, general
- **Flaw:** The invite token appears in the URL as a query parameter at every step: `/invite/accept?token=xxx`, `/auth/login?next=/invite/accept?token=xxx&auto_accept=true`, and in the auth callback redirect. URLs are logged by web servers, CDNs, proxies, browser history, Referer headers, and analytics tools. The token is a bearer credential — possession equals authorization to join a team.
- **Failure scenario:** User clicks invite link. Token appears in Nginx access logs, Vercel function logs, browser history, and any analytics script. Attacker with access to any of these log sources extracts the token and uses it to join the team (if not yet accepted). The `Referrer-Policy: strict-origin-when-cross-origin` header in middleware mitigates cross-origin Referer leakage but does NOT prevent same-origin leakage or server-side logging.
- **Evidence:** The plan's entire flow is token-in-URL. The existing system already uses this pattern (see `invite-accept-form.tsx` passing `token` prop from server component that reads it from `searchParams`). This is an inherited architectural concern, but the plan expands the exposure surface by adding the notification bell (which now also handles tokens) and the auto-signup redirect chain (which passes the token through more URL hops).
- **Suggested fix:** This is a deeper architectural concern. Short-term: ensure `Cache-Control: no-store` on all pages that handle tokens. Ensure token is consumed (status changed from 'pending') atomically so replay from logs is not possible. Long-term: consider exchanging the token for a short-lived session-bound claim at first access, then using the claim ID in subsequent redirects.

---

## Finding 10: decline_team_invite does not check if the caller's email actually matches the invite

- **Severity:** High
- **Location:** Phase 1, section "decline_team_invite RPC" combined with Phase 2 "POST /api/invite/decline"
- **Flaw:** The plan says the RPC "Checks status pending, expiry, email match" but the email being checked is `p_user_email` which is passed from the API route. The critical question: is the token alone sufficient to decline, or is email verification truly enforced? If an attacker knows or guesses a valid token (64 hex chars is strong, but see Finding 1 where tokens are returned in the GET API), they can call the decline endpoint. The auth check confirms the caller is logged in, but any logged-in user can decline any invite if they have the token — the email check only confirms the caller's email matches the invite, which is correct authorization. BUT: with Finding 1 leaking tokens, any authenticated user who can see their own invitations endpoint could potentially manipulate responses or timing to obtain other users' tokens.
- **Failure scenario:** Combined with Finding 1: User A fetches their invitations. Due to a race condition or a future bug in the email filter (Finding 5), the response includes User B's invite with its token. User A calls decline with that token. The RPC checks `p_user_email` against the invite email — User A's email does not match User B's invite email, so it SHOULD reject. This is actually properly defended IF the email check works correctly. Downgrading this concern: the real risk is Finding 1 + Finding 5 combined, not this RPC in isolation.
- **Evidence:** Plan says email match is enforced. The existing `accept_team_invite` RPC at line 242 does enforce this: `IF LOWER(TRIM(p_user_email)) != LOWER(TRIM(v_invite.email)) THEN RAISE EXCEPTION`. The decline RPC should replicate this pattern.
- **Suggested fix:** Ensure the decline RPC replicates the exact same email-match check as accept. Add explicit test cases for: (1) valid token + wrong email = rejection, (2) expired invite + correct email = rejection, (3) already-declined invite + correct email = idempotent or rejection.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | Token leaked in GET invitations response | Critical |
| 2 | Open redirect / param loss in auto_accept chain | Critical |
| 3 | Login `isValidRedirect` blocks invite accept redirects | Critical |
| 4 | decline RPC trusts caller-supplied email parameter | High |
| 5 | Admin client bypasses RLS with no defense-in-depth | High |
| 6 | No rate limiting on polled GET endpoint | High |
| 7 | Fragile keyword-based error mapping leaks internals | Medium |
| 8 | Auto-accept useEffect race in StrictMode | Medium |
| 9 | Token exposed in URL at every hop | Medium |
| 10 | Decline auth depends on email check chain integrity | High |

**Blocking findings (must resolve before implementation):** 1, 2, 3

**High-risk findings (must address during implementation):** 4, 5, 6, 10

**Status:** DONE
**Summary:** 3 critical, 4 high, 3 medium severity findings. The plan has fundamental issues with token exposure in the invitations API, a broken redirect chain for auto-signup accept, and the login page actively blocking the planned flow.
