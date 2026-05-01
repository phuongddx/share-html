import { createClient as createServiceRoleClient } from "@supabase/supabase-js";

/** Service-role client — bypasses RLS, used for server-side writes (storage, inserts). */
export const createAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
};
