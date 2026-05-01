"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthUser } from "@/lib/use-auth-user";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Invite {
  id: string;
  role: string;
  token: string;
  created_at: string;
  team_name: string;
  team_slug: string;
  inviter_name: string;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function InviteNotificationBell() {
  const user = useAuthUser();
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard/invitations");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setInvites(data.invites ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user]);

  if (!user) return null;

  const count = invites.length;

  async function handleAccept(token: string, teamSlug: string) {
    const key = `accept:${token}`;
    setLoadingAction(key);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        toast.success("Joined team!");
        setInvites((prev) => prev.filter((i) => i.token !== token));
        router.push(`/dashboard/teams/${teamSlug}`);
      } else {
        const { error } = await res.json();
        toast.error(error || "Failed to accept");
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDecline(token: string) {
    const key = `decline:${token}`;
    setLoadingAction(key);
    try {
      const res = await fetch("/api/invite/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        toast.success("Invite declined");
        setInvites((prev) => prev.filter((i) => i.token !== token));
      } else {
        const { error } = await res.json();
        toast.error(error || "Failed to decline");
      }
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        className="relative p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-label={`Notifications${count > 0 ? ` (${count} pending)` : ""}`}
      >
        <Bell className="size-[18px]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="end">
        <PopoverHeader>
          <PopoverTitle>Pending Invitations</PopoverTitle>
        </PopoverHeader>
        {loading && invites.length === 0 && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" /> Loading...
          </div>
        )}
        {!loading && invites.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No pending invitations
          </p>
        )}
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-md border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{invite.team_name}</p>
                  <p className="text-xs text-muted-foreground">
                    from {invite.inviter_name} · {invite.role} · {formatTimeAgo(invite.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  disabled={!!loadingAction}
                  onClick={() => handleAccept(invite.token, invite.team_slug)}
                >
                  {loadingAction === `accept:${invite.token}` && <Loader2 className="size-3 animate-spin" />}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-xs"
                  disabled={!!loadingAction}
                  onClick={() => handleDecline(invite.token)}
                >
                  {loadingAction === `decline:${invite.token}` && <Loader2 className="size-3 animate-spin" />}
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
