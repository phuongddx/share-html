"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import type { TeamInvite } from "@dropitx/shared/types/team";

interface MembersPageClientProps {
  teamSlug: string;
  canInvite: boolean;
  pendingInvites: TeamInvite[];
}

export function MembersPageClient({
  teamSlug,
  canInvite,
  pendingInvites,
}: MembersPageClientProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      {canInvite && (
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" />
          Invite
        </Button>
      )}
      <InviteMemberDialog
        teamSlug={teamSlug}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        pendingInvites={pendingInvites}
      />
    </>
  );
}
