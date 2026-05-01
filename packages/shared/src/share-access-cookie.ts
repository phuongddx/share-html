import { createHmac, timingSafeEqual } from "crypto";

export const SHARE_ACCESS_COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

function getSecret(): string {
  const secret = process.env.SHARE_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SHARE_ACCESS_SECRET must be set and at least 32 characters");
  }
  return secret;
}

export function shareAccessCookieName(slug: string): string {
  return `share-access-${slug}`;
}

/** Create HMAC-SHA256 signed token: slug|exp|sig */
export function generateAccessValue(slug: string, exp: number): string {
  const payload = `${slug}|${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}|${sig}`;
}

/** Verify HMAC signature and expiry. */
export function verifySharePassword(slug: string, value: string): boolean {
  const parts = value.split("|");
  if (parts.length !== 3) return false;

  const [tokenSlug, expStr, sig] = parts;
  if (tokenSlug !== slug) return false;

  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Date.now() > exp * 1000) return false;

  const expected = createHmac("sha256", getSecret())
    .update(`${tokenSlug}|${expStr}`)
    .digest("base64url");

  const a = Buffer.from(sig, "base64url");
  const b = Buffer.from(expected, "base64url");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
