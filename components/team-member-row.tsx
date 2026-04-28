"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { TeamRole } from "@/types/team";
import { TEAM_ROLES } from "@/lib/team-utils";

interface TeamMemberRowProps {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  email?: string;
  role: TeamRole;
  /** Current user's role — determines edit permissions. */
  viewerRole: TeamRole;
  /** Whether this row is the current user. */
  isSelf: boolean;
  teamSlug: string;
  /** Called after successful role change or removal. */
  onRefresh: () => void;
}

const ROLE_COLORS: Record<TeamRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  editor: "secondary",
  viewer: "outline",
};

export function TeamMemberRow({
  userId,
  displayName,
  avatarUrl,
  email,
  role,
  viewerRole,
  isSelf,
  teamSlug,
  onRefresh,
}: TeamMemberRowProps) {
  const [changingRole, setChangingRole] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const canEditRole = viewerRole === "owner" && !isSelf;
  const canRemove = viewerRole === "owner" || isSelf;
  const display = displayName || email || userId.slice(0, 8);
  const initial = display[0].toUpperCase();

  async function handleChangeRole(newRole: TeamRole) {
    setChangingRole(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/dashboard/teams/${teamSlug}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      toast.success(`Role updated to ${newRole}`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setChangingRole(false);
    }
  }

  async function handleRemove() {
    const action = isSelf ? "leave the team" : `remove ${display}`;
    if (!confirm(`Are you sure you want to ${action}?`)) return;

    setRemoving(true);
    try {
      const res = await fetch(
        `/api/dashboard/teams/${teamSlug}/members?user_id=${userId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      toast.success(isSelf ? "You left the team" : `Removed ${display}`);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {/* Avatar */}
      {avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-8 rounded-full shrink-0"
        />
      ) : (
        <div className="size-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initial}
        </div>
      )}

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {display}
          {isSelf && (
            <span className="text-muted-foreground font-normal"> (you)</span>
          )}
        </p>
        {email && (
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        )}
      </div>

      {/* Role */}
      <div className="relative shrink-0">
        {canEditRole ? (
          <>
            <button
              className="flex items-center gap-1"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={changingRole}
              type="button"
            >
              <Badge variant={ROLE_COLORS[role]}>{role}</Badge>
              {changingRole ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ChevronDown className="size-3 text-muted-foreground" />
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-card border rounded-lg shadow-lg py-1 min-w-[100px]">
                {TEAM_ROLES.filter((r) => r !== role).map((r) => (
                  <button
                    key={r}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                    onClick={() => handleChangeRole(r)}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Badge variant={ROLE_COLORS[role]}>{role}</Badge>
        )}
      </div>

      {/* Remove / Leave */}
      {canRemove && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRemove}
          disabled={removing}
          className="text-destructive hover:text-destructive shrink-0"
          title={isSelf ? "Leave team" : `Remove ${display}`}
        >
          {removing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
        </Button>
      )}
    </div>
  );
}
