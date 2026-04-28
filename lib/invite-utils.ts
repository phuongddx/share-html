import { randomBytes } from "crypto";

/** Generate a cryptographically random invite token (32 bytes = 64 hex chars). */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/** Default invite expiry: 7 days from now. */
export function getInviteExpiry(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

/** Check if an invite is expired. */
export function isInviteExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}
