import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

function getSecret(): string {
  const secret = process.env.SHARE_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SHARE_ACCESS_SECRET must be set and at least 32 characters");
  }
  return secret;
}

function cookieName(slug: string): string {
  return `share-access-${slug}`;
}

/** Create HMAC-SHA256 signed token: slug|exp|sig */
function sign(slug: string, exp: number): string {
  const payload = `${slug}|${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}|${sig}`;
}

/** Verify HMAC signature and expiry. */
function verify(slug: string, value: string): boolean {
  const parts = value.split("|");
  if (parts.length !== 3) return false;

  const [tokenSlug, expStr, sig] = parts;
  if (tokenSlug !== slug) return false;

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp * 1000) return false;

  const expected = createHmac("sha256", getSecret())
    .update(`${tokenSlug}|${expStr}`)
    .digest("base64url");

  // Normalize to equal-length buffers before timing-safe compare to avoid length oracle
  const a = Buffer.from(sig, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Set HttpOnly access cookie after successful password entry. */
export async function setAccessCookie(slug: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE;
  const value = sign(slug, exp);
  const cookieStore = await cookies();
  cookieStore.set(cookieName(slug), value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/s/${slug}`,
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Check if a valid HMAC-signed access cookie exists for this slug. */
export async function hasValidAccessCookie(slug: string): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(cookieName(slug));
  if (!cookie?.value) return false;
  return verify(slug, cookie.value);
}
