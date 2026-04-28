/**
 * Public invite acceptance page — /invite/accept?token=xxx
 *
 * Flow:
 * 1. Look up invite token (server-side)
 * 2. Validate: not expired, not already accepted
 * 3. If user not logged in → prompt login
 * 4. If user logged in → strictly validate email matches invite email (Red Team Fix #9)
 * 5. Create team_members row, mark invite accepted
 * 6. Redirect to team dashboard
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { isInviteExpired } from "@/lib/invite-utils";
import { InviteAcceptForm } from "./invite-accept-form";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function InviteAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-destructive">Invalid Invite</h1>
          <p className="mt-2 text-muted-foreground">No invite token provided.</p>
        </div>
      </div>
    );
  }

  const supabase = createAdminClient();

  // Look up the invite by token
  const { data: invite, error: inviteError } = await supabase
    .from("team_invites")
    .select("id, team_id, email, role, expires_at, accepted_at, teams(name, slug)")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-destructive">Invite Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            This invite does not exist or may have been cancelled.
          </p>
        </div>
      </div>
    );
  }

  // Check if already accepted
  if (invite.accepted_at) {
    // Supabase join returns array for FK relationships
    const teamsRaw = invite.teams as unknown as { slug: string; name: string }[];
    const teamSlug = Array.isArray(teamsRaw) ? teamsRaw[0]?.slug : undefined;
    if (teamSlug) {
      redirect(`/dashboard/teams/${teamSlug}`);
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Invite Already Used</h1>
          <p className="mt-2 text-muted-foreground">This invite has already been accepted.</p>
        </div>
      </div>
    );
  }

  // Check expiry
  if (isInviteExpired(invite.expires_at)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-destructive">Invite Expired</h1>
          <p className="mt-2 text-muted-foreground">
            This invite expired on {new Date(invite.expires_at).toLocaleDateString()}.
            Please request a new invite.
          </p>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  const cookieStore = await cookies();
  const authClient = createClient(cookieStore);
  const { data: { user } } = await authClient.auth.getUser();

  // Supabase join returns array for FK relationships
  const teamsRaw = invite.teams as unknown as { slug: string; name: string }[];
  const teamData = Array.isArray(teamsRaw) ? teamsRaw[0] : null;

  if (!user) {
    // Not logged in — prompt login with the invite email
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Accept Team Invite</h1>
          <p className="mt-2 text-muted-foreground">
            You have been invited to join <strong>{teamData?.name ?? "a team"}</strong> as{" "}
            <strong>{invite.role}</strong>.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            This invite was sent to <strong>{invite.email}</strong>.
            Please log in with that email address to accept.
          </p>
          <a
            href={`/auth/login?next=/invite/accept?token=${encodeURIComponent(token)}`}
            className="mt-6 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Log In to Accept
          </a>
        </div>
      </div>
    );
  }

  // Red Team Fix #9: Strict email matching — logged-in user email must match invite email
  const userEmail = (user.email ?? "").toLowerCase().trim();
  const inviteEmail = invite.email.toLowerCase().trim();

  if (userEmail !== inviteEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-destructive">Email Mismatch</h1>
          <p className="mt-2 text-muted-foreground">
            This invite was sent to <strong>{invite.email}</strong>.
            You are currently logged in as <strong>{user.email}</strong>.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Please log in with the email address the invite was sent to.
          </p>
          <a
            href={`/auth/login?next=/invite/accept?token=${encodeURIComponent(token)}`}
            className="mt-6 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Log In with Correct Email
          </a>
        </div>
      </div>
    );
  }

  // All checks passed — render the acceptance form (client component for the action)
  return (
    <InviteAcceptForm
      inviteId={invite.id}
      teamId={invite.team_id}
      teamName={teamData?.name ?? "the team"}
      teamSlug={teamData?.slug ?? ""}
      role={invite.role}
      token={token}
    />
  );
}
