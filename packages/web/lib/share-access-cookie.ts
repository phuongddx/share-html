import { cookies } from "next/headers";
import {
  shareAccessCookieName,
  generateAccessValue,
  verifySharePassword,
  SHARE_ACCESS_COOKIE_MAX_AGE,
} from "@dropitx/shared/share-access-cookie";

/** Set HttpOnly access cookie after successful password entry. */
export async function setAccessCookie(slug: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SHARE_ACCESS_COOKIE_MAX_AGE;
  const value = generateAccessValue(slug, exp);
  const cookieStore = await cookies();
  cookieStore.set(shareAccessCookieName(slug), value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/s/${slug}`,
    maxAge: SHARE_ACCESS_COOKIE_MAX_AGE,
  });
}

/** Check if a valid HMAC-signed access cookie exists for this slug. */
export async function hasValidAccessCookie(slug: string): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(shareAccessCookieName(slug));
  if (!cookie?.value) return false;
  return verifySharePassword(slug, cookie.value);
}
