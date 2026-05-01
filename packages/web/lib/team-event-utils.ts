import type { TeamEventType } from "@dropitx/shared/types/team-event";
import {
  Mail,
  MailCheck,
  MailX,
  MailMinus,
  Clock,
  UserPlus,
  UserMinus,
  Shield,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Map event type to its corresponding lucide icon. */
export function getEventIcon(eventType: TeamEventType): LucideIcon {
  const iconMap: Record<TeamEventType, LucideIcon> = {
    "invite.created": Mail,
    "invite.accepted": MailCheck,
    "invite.declined": MailX,
    "invite.revoked": MailMinus,
    "invite.expired": Clock,
    "member.joined": UserPlus,
    "member.left": UserMinus,
    "member.role_changed": Shield,
    "member.removed": UserX,
  };
  return iconMap[eventType];
}

/** Map event type to a tailwind text-color class. */
export function getEventColor(eventType: TeamEventType): string {
  const colorMap: Record<TeamEventType, string> = {
    "invite.created": "text-blue-500",
    "invite.accepted": "text-green-500",
    "invite.declined": "text-yellow-500",
    "invite.revoked": "text-red-500",
    "invite.expired": "text-muted-foreground",
    "member.joined": "text-green-500",
    "member.left": "text-yellow-500",
    "member.role_changed": "text-blue-500",
    "member.removed": "text-red-500",
  };
  return colorMap[eventType];
}

/** Human-readable description for a team event. */
export function formatEventDescription(
  eventType: TeamEventType,
  metadata: Record<string, unknown>,
): string {
  switch (eventType) {
    case "invite.created":
      return `Invited ${metadata.email ?? "someone"} as ${metadata.role ?? "viewer"}`;
    case "invite.accepted":
      return `${metadata.email ?? "Someone"} accepted the invite`;
    case "invite.declined":
      return `${metadata.email ?? "Someone"} declined the invite`;
    case "invite.revoked":
      return `Revoked invite for ${metadata.email ?? "someone"}`;
    case "invite.expired":
      return `Invite for ${metadata.email ?? "someone"} expired`;
    case "member.joined":
      return `${metadata.email ?? "Someone"} joined the team as ${metadata.role ?? "member"}`;
    case "member.left":
      return `${metadata.role ?? "Member"} left the team`;
    case "member.role_changed":
      return `Changed role from ${metadata.old_role ?? "?"} to ${metadata.new_role ?? "?"}`;
    case "member.removed":
      return `Removed ${metadata.role ?? "member"} from the team`;
    default:
      return eventType;
  }
}

/** Group events into Today / Yesterday / Earlier buckets. */
export function groupEventsByDate<T extends { created_at: string }>(
  events: T[],
): { label: string; events: T[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: { label: string; events: typeof events }[] = [
    { label: "Today", events: [] },
    { label: "Yesterday", events: [] },
    { label: "Earlier", events: [] },
  ];

  for (const event of events) {
    const date = new Date(event.created_at);
    if (date >= today) {
      groups[0].events.push(event);
    } else if (date >= yesterday) {
      groups[1].events.push(event);
    } else {
      groups[2].events.push(event);
    }
  }

  return groups.filter((g) => g.events.length > 0);
}

/** Format an ISO date string as a relative time label (e.g. "3h ago"). */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
