# Code Review: Share HTML Platform

## Scope
- Files: 19 implementation files
- LOC: ~620
- Focus: Full platform review (security, correctness, code quality)
- Date: 2026-04-21

## Overall Assessment

A clean, focused Next.js 15 app with good fundamentals: compensating transactions on upload failure, RLS enabled, proper search with tsvector, sandboxed iframe rendering. However, there are several security and correctness issues that need attention before production deployment.

---

## Critical Issues

### 1. Rate limit bypass via IP spoofing
**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/upload/route.ts` lines 19-25
**Severity:** Critical

`getClientIp` trusts `x-forwarded-for` unconditionally. Any client can set this header to any value, bypassing rate limiting entirely. Behind a proper reverse proxy the first entry is correct, but without validation an attacker sends `X-Forwarded-For: 1.2.3.4` and gets a fresh rate limit bucket per request.

```ts
// Current (vulnerable)
const forwarded = request.headers.get("x-forwarded-for");
if (forwarded) {
  return forwarded.split(",")[0].trim();
}
```

**Fix:** In production behind a trusted proxy, read only from `x-real-ip` (set by proxy) or configure Next.js `trustProxy` and read the "real" forwarded entry. In development, fall back to `"unknown"`. Alternatively, rate-limit on a combination of IP + fingerprint or require authentication.

```ts
function getClientIp(request: NextRequest): string {
  // Prefer x-real-ip set by trusted reverse proxy (Vercel sets this)
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  // Fallback: trust first entry only behind a known proxy
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
```

---

### 2. iframe sandbox escape via `sandbox="allow-scripts"` + no CSP
**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/html-viewer.tsx` line 47
**Severity:** Critical

The iframe uses `sandbox="allow-scripts"` which permits JavaScript execution in the shared HTML. Combined with the absence of a Content Security Policy (CSP) header on the response, this creates several attack vectors:

- **Top-level navigation:** The shared HTML can call `window.open()` or `window.top.location.href = ...` -- though `sandbox` without `allow-top-navigation` blocks this, `allow-scripts` alone already enables most XSS payloads.
- **`postMessage` abuse:** The shared HTML can post messages to the parent window. The `handleMessage` listener in `HtmlViewer` (lines 16-27) only accepts `event.data?.type === "error"`, but a malicious HTML file can set this to trigger fake error states and hide the iframe content.
- **Form submissions / popups:** `sandbox="allow-scripts"` without `allow-forms` or `allow-popups` blocks those, which is correct. But `allow-scripts` alone is still quite permissive.

**Fix:** Add a CSP meta tag to the iframe content and tighten the sandbox:

```ts
const safeHtml = `
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob: *;">
  ${htmlContent.replace(/<head([^>]*)>/i, (match) => {
    // Already has <head> — skip, CSP meta handles it
    return match;
  })}
`.replace(/^/, () => {
  // Inject CSP meta at start if no <head> tag exists
  if (!/<head/i.test(htmlContent)) {
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob: *;">`;
  }
  return '';
});
```

A more robust approach: inject CSP into the `srcDoc` by prepending a `<meta>` tag. Also consider adding `allow-same-origin` only if the HTML needs to load same-origin resources (currently it should not need this).

---

### 3. No middleware or CSP headers on the platform itself
**File:** `/Users/ddphuong/Projects/next-labs/share-html` (no `middleware.ts`)
**Severity:** Critical

There is no middleware.ts and no `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, or `Referrer-Policy` headers. The entire app runs without security headers.

**Fix:** Add a `middleware.ts` with security headers:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src 'self';"
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## High Priority

### 4. View count race condition
**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/s/[slug]/page.tsx` lines 62-65
**Severity:** High

The view count increment uses `share.view_count + 1` which is a read-then-write pattern. Concurrent requests will clobber each other. With the service_role key bypassing RLS, this is a direct DB race.

```ts
await supabase
  .from("shares")
  .update({ view_count: share.view_count + 1 })
  .eq("id", share.id);
```

**Fix:** Use a server-side RPC for atomic increment, or add a Postgres function:

```sql
CREATE OR REPLACE FUNCTION increment_view_count(p_id UUID)
RETURNS void AS $$
  UPDATE shares SET view_count = view_count + 1 WHERE id = p_id;
$$ LANGUAGE sql;
```

Then call `supabase.rpc('increment_view_count', { p_id: share.id })`.

Also: the displayed view count on line 86 is `share.view_count + 1`, but this double-counts if the increment RPC fails silently. It should show `share.view_count` and let the increment happen fire-and-forget, or fetch the updated count.

---

### 5. `search_shares` RPC is missing `SECURITY DEFINER` / access control
**File:** `/Users/ddphuong/Projects/next-labs/share-html/supabase/schema.sql` lines 34-50
**Severity:** High

The RPC function defaults to `SECURITY INVOKER`. Since RLS is enabled on `shares` with `"Public read access"`, the function works because the caller can read. However, the server uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS entirely, so the `Public read access` policy is not the guard rail here -- the service role key is.

The real risk: if the anon key is ever used to call this RPC (e.g., from a client component), it would still work because RLS allows public read. This is acceptable for a public search. However, the `search_shares` function passes `query_term` directly to `websearch_to_tsquery`, which will throw a Postgres error on malformed syntax rather than returning empty results gracefully. The API route catches this but the error message from Postgres may leak in logs.

**Fix:** Wrap the RPC call in a `BEGIN ... EXCEPTION WHEN OTHERS` block to gracefully handle tsquery parse errors:

```sql
BEGIN
  RETURN QUERY
  SELECT ...
  WHERE s.search_vec @@ websearch_to_tsquery('english', query_term)
  ...
EXCEPTION WHEN OTHERS THEN
  -- Return empty result on parse error
  RETURN QUERY SELECT ''::varchar, ''::varchar, NOW()::timestamptz, 0, NOW()::timestamptz, ''::text, 0.0::real WHERE false;
END;
```

---

### 6. No slug format validation in API routes
**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/shares/[slug]/route.ts` line 17
**Severity:** High

The slug from the URL path is passed directly to the DB query without format validation. While Supabase client parameterizes queries (preventing SQL injection), an excessively long slug or unexpected characters could still cause unexpected behavior. This is defense-in-depth, not a direct vulnerability.

**Fix:**

```ts
const { slug } = await params;
if (!/^[a-zA-Z0-9_-]{1,20}$/.test(slug)) {
  return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
}
```

Similarly for `/app/s/[slug]/page.tsx`.

---

### 7. Storage bucket publicly readable — HTML files accessible without expiration check
**File:** `/Users/ddphuong/Projects/next-labs/share-html/supabase/schema.sql` line 58
**Severity:** High

The comment says `Public: true` for the `html-files` storage bucket. This means anyone with the storage path (a UUID) can access HTML files directly via the Supabase storage URL, bypassing the expiration check in the app. If someone obtains the `storage_path` from the DB or through a timing side-channel, expired files remain accessible.

**Fix:** Set the storage bucket to private and serve files through the server route using the service role key. Or, rely on the scheduled cleanup job to actually remove files upon expiration (currently manual-only).

---

### 8. Delete token returned in API response — exposed in network tab
**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/upload/route.ts` lines 152-159
**Severity:** High

The `deleteToken` is returned in the JSON response body of the upload API. Any network observer (browser dev tools, proxy, browser extension) can capture this token. Combined with the public slug, this means anyone who observes the upload response can delete the share.

This is somewhat by design (the user needs the token), but the response also includes it as a plain field. Consider:
- Not returning it in the JSON body at all -- instead, return a one-time-use delete URL
- Or at minimum, the `ShareLink` component (line 87) warns the user, which is good UX but not a security control

**Fix:** This is acceptable for the current threat model (no authentication). Document the trade-off. If stronger security is needed, require re-authentication or use short-lived signed delete URLs.

---

## Medium Priority

### 9. `extractTextFromHtml` entity decoding is incomplete
**File:** `/Users/ddphuong/Projects/next-labs/share-html/lib/extract-text.ts` lines 25-31
**Severity:** Medium

Only 6 HTML entities are decoded. Many more exist (`&#x27;`, `&mdash;`, `&ndash;`, numeric references like `&#8212;`, named references like `&copy;`). This means search indexing will miss content with common entities.

**Fix:** Use the browser's `DOMParser` in a server context (JSDOM) or add a more comprehensive entity map. For a pragmatic fix, add at minimum the numeric reference pattern:

```ts
text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
text = text.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
```

---

### 10. `x-forwarded-proto` trusted for URL construction
**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/upload/route.ts` line 149
**Severity:** Medium

The share URL is constructed using `x-forwarded-proto` header, which can be set by the client. On Vercel this is set correctly, but in self-hosted scenarios this could produce incorrect URLs (http instead of https, or vice versa).

**Fix:** In production, prefer `NEXTAUTH_URL` or `NEXT_PUBLIC_BASE_URL` env var. Fallback to `x-forwarded-proto` only in known proxy environments.

---

### 11. No `max` parameter on page clamp allows unbounded offset
**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/api/search/route.ts` line 36
**Severity:** Medium

`page` is clamped to max 1000 and `limit` to max 100, so `offset` can be up to `(1000-1) * 100 = 99,900`. With 100 rows per page, this is a 99,900-row offset which can be slow on large tables (Postgres OFFSET is linear). However, shares are time-limited (30 days) and likely don't reach this scale. Low risk in practice.

**Fix:** Use keyset pagination (cursor-based) for production-grade search if scale becomes a concern. Not blocking for MVP.

---

### 12. `html-viewer.tsx` error message can display attacker-controlled text
**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/html-viewer.tsx` lines 21-24
**Severity:** Medium

A malicious HTML file inside the iframe can post `{ type: "error", message: "anything" }` to the parent window. The `HtmlViewer` displays this message as JSX text, which is safe from injection (React auto-escapes). However, it allows the shared HTML to manipulate the UI state -- hiding the iframe and showing a fake error message. This could be used for social engineering (e.g., "This file requires a plugin download").

**Fix:** Validate the error message source more strictly, or don't trust `postMessage` from the sandboxed iframe at all:

```ts
const handleMessage = (event: MessageEvent) => {
  if (event.source !== iframeRef.current?.contentWindow) return;
  // Only trust messages from a known origin (none, since srcDoc has null origin)
  // Ignore all postMessage from sandboxed content
};
```

---

### 13. Missing `rel="noopener noreferrer"` on search result links
**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/search-results.tsx` line 87
**Severity:** Medium

The `Link` to `/s/${r.slug}` is an internal Next.js link, so `rel` attributes don't apply. However, if these were ever changed to external links, they would need `rel="noopener noreferrer"`. Currently not a vulnerability since all links are internal. Noting for awareness only.

---

### 14. `SearchPage` re-searches on every query state change including programmatic sync
**File:** `/Users/ddphuong/Projects/next-labs/share-html/app/search/page.tsx` lines 56-63
**Severity:** Medium

The `useEffect` on `query` triggers a search on every change, including when `searchParams.then()` resolves and sets `query` from the URL. This is correct behavior but means: (a) the search fires on mount, (b) if `SearchBar`'s debounce fires simultaneously, there could be two requests. The `performSearch` callback has no abort controller, so both complete and the second overwrites the first. Minor inefficiency, no correctness bug.

**Fix:** Add an AbortController to cancel in-flight requests when a new search starts:

```ts
const performSearch = useCallback(async (term: string, signal?: AbortSignal) => {
  // ...
  const res = await fetch(`/api/search?q=...`, { signal });
  // ...
}, []);
```

---

## Low Priority

### 15. ` ShareLink` delete URL shown without the token
**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/share-link.tsx` lines 24-27, 94
**Severity:** Low

The delete URL is displayed as `${window.location.origin}/api/shares/${result.slug}` without the `deleteToken`. The user sees the DELETE endpoint URL but not how to use it (DELETE with JSON body `{ deleteToken: "..." }`). This is a UX issue, not a security bug -- the user can't meaningfully use this URL from a browser.

**Fix:** Either remove the delete URL display (keep only the token), or add a note explaining it requires the token in a DELETE request body.

---

### 16. `share-link.tsx` delete URL not actually usable as a link
**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/share-link.tsx` line 94
**Severity:** Low

The displayed delete URL points to the API endpoint `/api/shares/{slug}` which requires a DELETE method with a JSON body. Showing it as a plain URL is misleading. Users might expect clicking it to delete the share, but it won't work as a GET request.

---

### 17. `relativeTime` uses client time, not server time
**File:** `/Users/ddphuong/Projects/next-labs/share-html/components/search-results.tsx` lines 13-26
**Severity:** Low

`Date.now()` uses the client's clock. If the client clock is wrong, relative times will be inaccurate. Acceptable for this use case.

---

### 18. Hardcoded expiry interval not configurable
**File:** `/Users/ddphuong/Projects/next-labs/share-html/supabase/schema.sql` line 16
**Severity:** Low

`DEFAULT (NOW() + INTERVAL '30 days')` is hardcoded. If you want to change expiry duration, you need a schema migration. Consider using an env var or config for this.

---

## Positive Observations

- **Compensating transaction on upload failure**: Storage cleanup on DB insert failure is well-handled.
- **RLS enabled** with explicit policy, not left to default.
- **Sandboxed iframe** with minimal permissions (`allow-scripts` only, no `allow-same-origin`).
- **Parameterized queries** via Supabase client (no raw SQL injection risk).
- **TypeScript types** are consistent between frontend and API.
- **Clean separation** of concerns: upload, delete, search, and view are separate routes.
- **Rate limiting** with graceful fallback for dev/build environments.
- **Proper error handling** in all API routes with try/catch and meaningful error responses.
- **Expiry check** on the share page prevents viewing expired content (at the app level).
- **`fatal: true`** on TextDecoder prevents silent data corruption from non-UTF-8 files.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 5 |
| Medium | 6 |
| Low | 4 |
| **Total** | **18** |

### Overall: NEEDS FIXES

The 3 critical issues (rate limit bypass, iframe sandbox + CSP, missing security headers) must be resolved before production deployment. The high-priority issues (view count race condition, RPC error handling, slug validation, storage bucket access control) should be addressed in the same pass.

### Recommended Action Order

1. Add `middleware.ts` with security headers (Critical #3)
2. Fix `getClientIp` to use `x-real-ip` or a trusted source (Critical #1)
3. Inject CSP meta tag into iframe `srcDoc` content (Critical #2)
4. Add atomic view count RPC and remove fake `+1` display (High #4)
5. Wrap `search_shares` RPC in exception handler (High #5)
6. Add slug format validation (High #6)
7. Set storage bucket to private or document the trade-off (High #7)

---

## Unresolved Questions

- Is this deployed on Vercel or self-hosted? Affects IP header trust and CSP header strategy.
- Is there a scheduled job for expired share cleanup, or is it truly manual-only? Manual-only means orphaned storage objects accumulate.
- Is the `SUPABASE_SERVICE_ROLE_KEY` only available server-side? No middleware to enforce this -- relies entirely on not importing `server.ts` in client code.
