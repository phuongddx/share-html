import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@/utils/supabase/server";

const API_URL = process.env.API_URL || "http://localhost:3001";

/**
 * Typed fetch wrapper for Hono API.
 * Automatically includes JWT from Supabase session as Bearer token.
 *
 * @example
 * ```ts
 * const shares = await apiClient<Share[]>('/search?owner=me');
 * const team = await apiClient<Team>('/dashboard/teams/my-team');
 * ```
 */
export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies();
  const supabase = createSupabaseClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = `${API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token && {
        Authorization: `Bearer ${session.access_token}`,
      }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch from public API endpoints without authentication.
 * Used for share viewer page and other public data.
 */
export async function publicApiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
