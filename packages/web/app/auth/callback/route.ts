import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildProfileSeed } from "@dropitx/shared/supabase/profile";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Open redirect protection: only allow relative paths starting with /
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: existingProfile, error: profileLookupError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileLookupError) {
          console.error("Profile lookup failed during auth callback", profileLookupError);
        } else if (!existingProfile) {
          const { error: insertError } = await supabase
            .from("user_profiles")
            .insert(buildProfileSeed(user));

          if (insertError) {
            console.error("Profile bootstrap failed during auth callback", insertError);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}
