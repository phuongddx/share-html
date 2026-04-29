"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { TeamMemberRow } from "@/components/team-member-row";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import type { TeamRole, TeamInvite } from "@/types/team";

interface MemberData {
  user_id: string;
  role: TeamRole;
  joined_at: string;
  display_name?: string;
  avatar_url?: string;
}

interface TeamData {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export default function TeamMembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string>("");
  const [team, setTeam] = useState<TeamData | null>(null);
  const [currentRole, setCurrentRole] = useState<TeamRole>("viewer");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [members, setMembers] = useState<MemberData[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const fetchedRef = useRef<string>("");

  // Extract slug from params
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  // Fetch all team data when slug changes
  useEffect(() => {
    if (!slug || fetchedRef.current === slug) return;
    fetchedRef.current = slug;

    let cancelled = false;
    (async () => {
      try {
        // Get current auth user
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        const [teamRes, membersRes, invitesRes] = await Promise.all([
          fetch(`/api/dashboard/teams/${slug}`),
          fetch(`/api/dashboard/teams/${slug}/members`),
          fetch(`/api/dashboard/teams/${slug}/invites`),
        ]);

        if (cancelled) return;
        if (!teamRes.ok) throw new Error("Failed to load team");
        const teamData = await teamRes.json();
        setTeam(teamData);

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          const memberList: MemberData[] = membersData.members ?? [];
          setMembers(memberList);
          if (user) {
            const myMember = memberList.find((m) => m.user_id === user.id);
            if (myMember) setCurrentRole(myMember.role);
          }
        }

        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          setInvites(
            (invitesData.invites ?? []).filter(
              (inv: TeamInvite) => !inv.accepted_at,
            ),
          );
        }
      } catch {
        if (!cancelled) toast.error("Failed to load team data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  /** Reset fetched ref and trigger re-fetch on invite/member changes. */
  function handleRefresh() {
    fetchedRef.current = "";
    setLoading(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Team not found.</p>
      </div>
    );
  }

  const canInvite = currentRole === "owner" || currentRole === "editor";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/dashboard/teams/${slug}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="size-3" />
            Back to Team
          </Link>
          <h1 className="font-mono text-lg font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {team.name} · {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canInvite && (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            Invite
          </Button>
        )}
      </div>

      <Card className="border border-border rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {members.map((m) => (
              <TeamMemberRow
                key={m.user_id}
                userId={m.user_id}
                displayName={m.display_name ?? null}
                avatarUrl={m.avatar_url ?? null}
                role={m.role}
                viewerRole={currentRole}
                isSelf={m.user_id === currentUserId}
                teamSlug={slug}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              No members found.
            </p>
          )}
        </CardContent>
      </Card>

      <InviteMemberDialog
        teamSlug={slug}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInviteCreated={handleRefresh}
        pendingInvites={invites}
      />
    </div>
  );
}
