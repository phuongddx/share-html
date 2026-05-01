/**
 * POST /api/dashboard/teams/[slug]/invites/bulk — Create multiple invites at once.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember } from "../../route";
import { generateInviteToken, getInviteExpiry } from "@/lib/invite-utils";
import type { TeamRole } from "@dropitx/shared/types/team";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const result = await requireTeamMember(slug, "editor");
    if (!result.ok) return result.error;
    const { team, supabase } = result;

    const body = await request.json();
    const { emails, role }: { emails?: string[]; role?: TeamRole } = body;

    // Validate input
    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400 });
    }

    if (emails.length > 50) {
      return NextResponse.json({ error: "Maximum 50 emails allowed per bulk request" }, { status: 400 });
    }

    // Validate role
    const inviteRole: TeamRole = (role && ["owner", "editor", "viewer"].includes(role)) ? role : "viewer";

    // Only owners can invite as owner
    if (inviteRole === "owner" && result.userRole !== "owner") {
      return NextResponse.json({ error: "Only owners can invite new owners" }, { status: 403 });
    }

    // Validate emails
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];

    emails.forEach(email => {
      const trimmed = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (trimmed && emailRegex.test(trimmed)) {
        validEmails.push(trimmed.toLowerCase());
      } else {
        invalidEmails.push(trimmed);
      }
    });

    if (validEmails.length === 0) {
      return NextResponse.json({
        error: "No valid email addresses provided",
        invalid_emails: invalidEmails
      }, { status: 400 });
    }

    // Check for existing pending invites
    const existingEmails = new Set<string>();
    if (validEmails.length > 0) {
      const { data: existingInvites } = await supabase
        .from("team_invites")
        .select("email")
        .in("email", validEmails)
        .eq("team_id", team.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString());

      existingInvites?.forEach(invite => {
        existingEmails.add(invite.email);
      });
    }

    const invitesToCreate = validEmails.filter(email => !existingEmails.has(email));
    const duplicateEmails = validEmails.filter(email => existingEmails.has(email));

    // Create invites
    const createdInvites = [];
    const errors = [];

    for (const email of invitesToCreate) {
      const token = generateInviteToken();
      const expiresAt = getInviteExpiry();

      const { data: invite, error } = await supabase
        .from("team_invites")
        .insert({
          team_id: team.id,
          email,
          role: inviteRole,
          token,
          expires_at: expiresAt,
          invited_by: (await supabase.auth.getUser()).data.user!.id,
        })
        .select("id, email, role, token, expires_at, created_at")
        .single();

      if (error) {
        console.error(`Failed to create invite for ${email}:`, error.message);
        errors.push({ email, error: error.message });
      } else {
        createdInvites.push(invite);
      }
    }

    // Generate invite URLs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
    const invitesWithUrls = createdInvites.map(invite => ({
      ...invite,
      invite_url: `${appUrl}/invite/accept?token=${invite.token}`
    }));

    return NextResponse.json({
      success: true,
      created_count: invitesWithUrls.length,
      duplicate_count: duplicateEmails.length,
      error_count: errors.length,
      invites: invitesWithUrls,
      duplicates: duplicateEmails,
      errors: errors,
      summary: {
        total_attempted: validEmails.length,
        successful: invitesWithUrls.length,
        duplicates: duplicateEmails.length,
        failed: errors.length
      }
    }, { status: 201 });

  } catch (err) {
    console.error("POST /api/dashboard/teams/[slug]/invites/bulk error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}