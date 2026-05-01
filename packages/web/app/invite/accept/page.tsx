/**
 * Public invite acceptance page — /invite/accept?token=xxx
 *
 * Server component flow:
 * 1. Look up invite token from API (public endpoint)
 * 2. Validate status column (pending, accepted, revoked, expired)
 * 3. If user not logged in -> prompt login via InviteStatusCard
 * 4. If user logged in -> strictly validate email matches invite email
 * 5. All checks passed -> render InviteAcceptForm inside InviteStatusCard
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { publicApiClient } from "@/lib/api-client";
import { InviteStatusCard } from "@/components/invite-status-card";
import { InviteAcceptForm } from "./invite-accept-form";

interface Props {
  searchParams: Promise<{ token?: string; auto_accept?: string }>;
}

interface InviteDetails {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  team: {
    id: string;
    name: string;
    slug: string;
  };
}

export default async function InviteAcceptPage({ searchParams }: Props) {
  const { token, auto_accept } = await searchParams;

  if (!token) {
    return (
      <InviteStatusCard
        variant="not_found"
        message="No invite token provided."
      />
    );
  }

  // Fetch invite details from public API
  const invite = await publicApiClient<InviteDetails>(`/invite/details/${token}`).catch(() => null);

  if (!invite) {
    return (
      <InviteStatusCard
        variant="not_found"
        message="This invite does not exist or may have been cancelled."
      />
    );
  }

  // Already accepted — redirect to team or show used status
  if (invite.status === "accepted") {
    redirect(`/dashboard/teams/${invite.team.slug}`);
  }

  // Declined invite
  if (invite.status === "declined") {
    return (
      <InviteStatusCard
        variant="not_found"
        message="You already declined this invitation. Contact the team owner for a new invite."
      />
    );
  }

  // Revoked invite
  if (invite.status === "revoked") {
    return (
      <InviteStatusCard
        variant="not_found"
        message="This invite has been revoked."
      />
    );
  }

  // Expired — either status column or actual date check
  if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
    return (
      <InviteStatusCard
        variant="expired"
        message={`This invite expired on ${new Date(invite.expires_at).toLocaleDateString()}.`}
        subMessage="Please request a new invite."
      />
    );
  }

  // Invite is valid — check auth
  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const teamData = invite.team;

  if (!user) {
    const loginUrl = `/auth/login?next=${encodeURIComponent(`/invite/accept?token=${token}&auto_accept=true`)}`;
    const signupUrl = `/auth/login?mode=signup&next=${encodeURIComponent(`/invite/accept?token=${token}&auto_accept=true`)}`;
    return (
      <InviteStatusCard
        variant="not_logged_in"
        message={`You have been invited to join ${teamData?.name ?? "a team"} as ${invite.role}.`}
        inviteEmail={invite.email}
        loginUrl={loginUrl}
        signupUrl={signupUrl}
      />
    );
  }

  // Strict email matching
  const userEmail = (user.email ?? "").toLowerCase().trim();
  const inviteEmail = invite.email.toLowerCase().trim();
  if (userEmail !== inviteEmail) {
    return (
      <InviteStatusCard
        variant="email_mismatch"
        inviteEmail={invite.email}
        currentUserEmail={user.email}
        loginUrl={`/auth/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
      />
    );
  }

  // All checks passed — render form inside the card
  return (
    <InviteStatusCard
      variant="invite_info"
      message={`You have been invited to join ${teamData?.name ?? "the team"} as ${invite.role}.`}
      inviteEmail={invite.email}
    >
      <InviteAcceptForm teamSlug={teamData?.slug ?? ""} token={token} autoAccept={auto_accept === "true"} />
    </InviteStatusCard>
  );
}
