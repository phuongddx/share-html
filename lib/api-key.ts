/**
 * API key generation and hashing utilities.
 * Keys follow the format: shk_{48 hex chars}. Only the SHA-256 hash is stored.
 */

import { createHash, randomBytes } from "crypto";

export function generateApiKey(): {
  key: string;
  hash: string;
  prefix: string;
} {
  const random = randomBytes(24).toString("hex");
  const key = `shk_${random}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
