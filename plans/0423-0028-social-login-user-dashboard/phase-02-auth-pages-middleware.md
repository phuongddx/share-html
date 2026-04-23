# Phase 2: Auth Pages & Middleware

## Context Links
- Phase 1: `phase-01-database-auth-config.md`
- Existing middleware: `middleware.ts`
- Existing Supabase clients: `utils/supabase/client.ts`, `utils/supabase/server.ts`, `utils/supabase/middleware.ts`

## Overview
- **Priority:** P1 (auth foundation)
- **Status:** Complete
- Create login page with custom Google + GitHub OAuth buttons, OAuth callback route handler, update middleware to protect dashboard routes.
<!-- Updated: Red Team - Replaced @supabase/auth-ui-react with custom buttons (React 19 incompatibility risk). Added open redirect fix. Added CSP update. -->

## Key Insights
- Custom OAuth buttons via `supabase.auth.signInWithOAuth()` — no external dependency, full style control
- Must be a client component (`"use client"`) — Supabase browser client
- OAuth callback uses PKCE flow — Supabase SSR handles code exchange
- Dashboard routes (`/dashboard/*`) need auth guard in middleware
<!-- Updated: Red Team - CSP must allow form-action to OAuth providers -->

## Requirements
### Functional
- `/auth/login` page with Google + GitHub login buttons (custom, not auth-ui-react)
- `/auth/callback` route for OAuth redirect handling (with open redirect protection)
- Middleware protects `/dashboard/*` — redirects unauthenticated users to `/auth/login`
- CSP headers updated to allow OAuth redirects
- After login, redirect to `/dashboard`

### Non-Functional
- Match existing blue accent design theme
- Full control over button styling (no third-party CSS overrides needed)

## Architecture
```
/auth/login (client component)
  ├── Google button → supabase.auth.signInWithOAuth({ provider: 'google' })
  └── GitHub button → supabase.auth.signInWithOAuth({ provider: 'github' })

/auth/callback (route handler)
  └── Code exchange → safe redirect to /dashboard

middleware.ts
  ├── CSP update: form-action for OAuth providers
  └── If /dashboard/* && !authenticated → redirect /auth/login
```

## Related Code Files
### Modify
- `middleware.ts` — add auth guard for `/dashboard/*`, update CSP headers
<!-- Updated: Red Team - NO @supabase/auth-ui-react dependency -->

### Create
- `app/auth/login/page.tsx` — login page with custom OAuth buttons
- `app/auth/callback/route.ts` — OAuth callback handler

## Implementation Steps

1. **No new packages needed** — custom OAuth buttons use existing `@supabase/ssr` + `@supabase/supabase-js`
   <!-- Updated: Red Team - Skip auth-ui-react entirely -->

2. **Create `app/auth/login/page.tsx`:**
   ```tsx
   "use client";
   import { createClient } from "@/utils/supabase/client";

   export default function LoginPage() {
     const supabase = createClient();
     const login = (provider: "google" | "github") =>
       supabase.auth.signInWithOAuth({
         provider,
         options: { redirectTo: `${window.location.origin}/auth/callback` },
       });

     return (
       <div className="flex min-h-screen items-center justify-center">
         <div className="w-full max-w-md space-y-4 rounded-lg border p-8">
           <h1 className="text-2xl font-bold text-center">Sign in</h1>
           <button onClick={() => login("google")} className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
             Continue with Google
           </button>
           <button onClick={() => login("github")} className="w-full rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900">
             Continue with GitHub
           </button>
         </div>
       </div>
     );
   }
   ```

3. **Create `app/auth/callback/route.ts`:**
   <!-- Updated: Red Team - Open redirect fix: validate `next` parameter -->
   ```ts
   import { NextResponse } from "next/server";
   import { createClient } from "@/utils/supabase/server";
   import { cookies } from "next/headers";

   export async function GET(request: Request) {
     const { searchParams, origin } = new URL(request.url);
     const code = searchParams.get("code");
     // Open redirect protection: only allow relative paths starting with /
     const rawNext = searchParams.get("next") ?? "/dashboard";
     const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

     if (code) {
       const cookieStore = await cookies();
       const supabase = createClient(cookieStore);
       const { error } = await supabase.auth.exchangeCodeForSession(code);
       if (!error) return NextResponse.redirect(`${origin}${next}`);
     }
     return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
   }
   ```

4. **Update `middleware.ts`:**
   - Add auth guard for `/dashboard/*`
   <!-- Updated: Red Team - Add CSP form-action for OAuth providers -->
   - Add `form-action 'self' https://accounts.google.com https://github.com/login/oauth/authorize;` to CSP for non-share pages
   ```ts
   // After session refresh:
   const { data: { user } } = await supabase.auth.getUser();

   // Protect dashboard routes
   if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
     const url = request.nextUrl.clone();
     url.pathname = "/auth/login";
     return NextResponse.redirect(url);
   }

   // CSP for non-share pages — add form-action for OAuth
   if (!request.nextUrl.pathname.startsWith("/s/")) {
     supabaseResponse.headers.set(
       "Content-Security-Policy",
       "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co https://*.upstash.io; form-action 'self' https://accounts.google.com https://github.com;",
     );
   }
   ```

## Todo List
- [x] Create /auth/login page with custom OAuth buttons
- [x] Create /auth/callback route handler (with redirect validation)
- [x] Update middleware with dashboard auth guard
- [x] Update CSP headers for OAuth providers
- [x] Test login flow end-to-end

## Success Criteria
- Clicking Google/GitHub button redirects to provider
- After OAuth, user lands on `/dashboard`
- Unauthenticated access to `/dashboard/*` redirects to `/auth/login`
- No email/password form visible
- CSP allows OAuth redirects without violations
- Open redirect via `next` param is blocked

## Risk Assessment
- **Custom buttons:** No external dependency, full control, works with any React version
- **Cookie handling:** Supabase SSR already handles cookies in middleware — callback route just needs code exchange
- **Redirect URL:** Must match exactly what's configured in Supabase dashboard + config.toml `additional_redirect_urls`
<!-- Updated: Red Team - Verify Supabase SSR cookie attributes -->
- **Cookie security:** Verify Supabase SSR sets cookies with `HttpOnly`, `SameSite=Lax`, `Secure` attributes

## Security Considerations
- PKCE flow handled by Supabase SSR — no manual token handling
- `exchangeCodeForSession` runs server-side — no token exposure to client
- Middleware refreshes session on every request — stale sessions auto-refreshed
<!-- Updated: Red Team - Open redirect prevention -->
- `next` parameter validated: must start with `/`, must not start with `//` (protocol-relative bypass)
- CSP `form-action` restricted to known OAuth providers only

## Next Steps
- Phase 3 builds dashboard layout and share history (requires auth to work)
