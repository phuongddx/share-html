import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  // Refresh session and get user
  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard routes (but allow /invite/accept as public)
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Security headers
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  supabaseResponse.headers.set("X-DNS-Prefetch-Control", "on");

  // Red Team Fix: 7 — Allow embedding of /embed/ routes with strict CSP (no unsafe-eval)
  if (request.nextUrl.pathname.startsWith("/embed/")) {
    supabaseResponse.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; frame-src 'self'; frame-ancestors *; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';",
    );
  } else {
    supabaseResponse.headers.set("X-Frame-Options", "DENY");
  }

  // CSP for non-share pages (includes form-action for OAuth providers)
  if (!request.nextUrl.pathname.startsWith("/s/")) {
    supabaseResponse.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com; font-src 'self'; connect-src 'self' https://*.supabase.co https://*.upstash.io; form-action 'self' https://accounts.google.com https://github.com;",
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
