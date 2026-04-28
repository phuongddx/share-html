import { randomBytes } from "crypto";
import type { TeamRole } from "@/types/team";

export const TEAM_ROLES = ["owner", "editor", "viewer"] as const;
export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

/** Check if actual role meets or exceeds required role. */
export function hasMinRole(actual: TeamRole, required: TeamRole): boolean {
  return (ROLE_HIERARCHY[actual] ?? 0) >= (ROLE_HIERARCHY[required] ?? 0);
}

/** Generate a URL-safe team slug from a name. Appends random suffix to avoid collisions. */
export function generateTeamSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  // Append 6-char random suffix to avoid collisions
  const suffix = randomBytes(3).toString("hex");
  return `${base}-${suffix}`.replace(/^-+|-+$/g, "");
}

/** Validate team slug format: 2-50 chars, lowercase alphanumeric + hyphens. */
export function isValidTeamSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

/** Validate team name: 1-100 chars, no control characters. */
export function isValidTeamName(name: string): boolean {
  return name.length >= 1 && name.length <= 100 && !/[\x00-\x1F\x7F]/.test(name);
}

/** Personal API key prefix. */
export const PERSONAL_KEY_PREFIX = "shk_";

/** Team API key prefix (to distinguish from personal keys). */
export const TEAM_KEY_PREFIX = "sht_";
