import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { buildProfileSeed } from "@dropitx/shared/supabase/profile";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const VALID_OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  if (!token_hash || !rawType || !VALID_OTP_TYPES.includes(rawType as EmailOtpType)) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=confirmation_failed`,
    );
  }

  const type = rawType as EmailOtpType;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=confirmation_failed`,
    );
  }

  // Recovery flow: redirect to update-password page
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/update-password`);
  }

  // Signup/email confirmation: create profile if needed
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from("user_profiles")
      .upsert(buildProfileSeed(user), { onConflict: "id" });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
