/**
 * API key generation and hashing utilities.
 * Keys follow the format: {prefix}_{48 hex chars}. Only the SHA-256 hash is stored.
 * Personal keys use "shk_" prefix, team keys use "sht_" prefix.
 */

import { createHash, randomBytes } from "crypto";

export type ApiKeyPrefix = "shk" | "sht";

export function generateApiKey(
  prefix: ApiKeyPrefix = "shk",
): {
  key: string;
  hash: string;
  prefix: string;
} {
  const random = randomBytes(24).toString("hex");
  const key = `${prefix}_${random}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, 12);
  return { key, hash, prefix: keyPrefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
