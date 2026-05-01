import { createServerClient } from "@supabase/ssr";

/**
 * Creates a Supabase client scoped to the JWT owner — RLS policies apply.
 * Used by Hono API to forward user JWT and preserve row-level security.
 */
export function createClientFromJWT(accessToken: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    },
  );
}
