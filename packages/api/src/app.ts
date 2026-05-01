import { Hono } from "hono";
import { cors } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";

// V1 REST API routes (API-key auth)
import { documents as v1Documents } from "./routes/v1/documents";
import { documentsSlug as v1DocumentsSlug } from "./routes/v1/documents-slug";
import { keys as v1Keys } from "./routes/v1/keys";
import { keysId as v1KeysId } from "./routes/v1/keys-id";

// Dashboard routes (cookie auth)
import { invitations } from "./routes/dashboard/invitations";
import { teams } from "./routes/dashboard/teams/index";
import { slug as teamsSlug } from "./routes/dashboard/teams/slug";
import { events as teamsEvents } from "./routes/dashboard/teams/events";
import { members as teamsMembers } from "./routes/dashboard/teams/members";
import { invites as teamsInvites } from "./routes/dashboard/teams/invites";
import { bulkInvites as teamsInvitesBulk } from "./routes/dashboard/teams/invites-bulk";
import { resend as teamsInvitesResend } from "./routes/dashboard/teams/invites-resend";
import { shares as teamsShares } from "./routes/dashboard/teams/shares";
import { favorites } from "./routes/dashboard/favorites";
import { analytics as dashboardAnalytics } from "./routes/dashboard/analytics";
import { dashboardShares } from "./routes/dashboard/shares";

// Share routes (mixed auth)
import { getShare } from "./routes/shares/get-share";
import sharesSlug from "./routes/shares/slug";
import sharesUnlock from "./routes/shares/unlock";
import sharesSetPassword from "./routes/shares/set-password";

// Invite routes (cookie auth)
import { accept as inviteAccept } from "./routes/invite/accept";
import { decline as inviteDecline } from "./routes/invite/decline";
import { getDetails as inviteGetDetails } from "./routes/invite/get-details";

// Content operation routes (cookie auth)
import { upload } from "./routes/upload";
import { imagesUpload } from "./routes/images-upload";
import { publish } from "./routes/publish";
import { search } from "./routes/search";

// Analytics + Meta routes (public)
import analyticsTrack from "./routes/analytics/track";
import oembed from "./routes/oembed";

export type AppEnv = {
  Variables: {
    auth: {
      userId: string;
      email?: string;
      teamId?: string;
      keyType?: "personal" | "team";
      /** "jwt" means RLS enforced via Supabase; "admin" means RLS bypassed. */
      clientRole: "jwt" | "admin";
      isAnonymous: boolean;
      supabaseClient: ReturnType<
        typeof import("@dropitx/shared/supabase/jwt-client").createClientFromJWT
      >;
    };
    /** Set by requireTeamMember middleware — team membership context. */
    teamMember?: {
      teamId: string;
      role: import("@dropitx/shared/types/team").TeamRole;
      slug: string;
      team: {
        id: string;
        name: string;
        slug: string;
        created_by: string;
        plan: string;
        created_at: string;
      };
    };
  };
};

export function createApp() {
  const app = new Hono<AppEnv>();

  // Global middleware
  app.use("*", cors());
  app.onError(errorHandler);

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }));

  // V1 REST API routes (API-key auth)
  app.route("/v1/documents", v1Documents);
  app.route("/v1/documents/:slug", v1DocumentsSlug);
  app.route("/v1/keys", v1Keys);
  app.route("/v1/keys/:id", v1KeysId);

  // Dashboard routes (cookie auth)
  app.route("/dashboard/invitations", invitations);
  app.route("/dashboard/favorites", favorites);
  app.route("/dashboard/analytics", dashboardAnalytics);
  app.route("/dashboard/shares", dashboardShares);
  app.route("/dashboard/teams", teams);
  app.route("/dashboard/teams/:slug", teamsSlug);
  app.route("/dashboard/teams/:slug/events", teamsEvents);
  app.route("/dashboard/teams/:slug/members", teamsMembers);
  app.route("/dashboard/teams/:slug/invites", teamsInvites);
  app.route("/dashboard/teams/:slug/invites/bulk", teamsInvitesBulk);
  app.route("/dashboard/teams/:slug/invites/:inviteId/resend", teamsInvitesResend);
  app.route("/dashboard/teams/:slug/shares", teamsShares);

  // Share routes (mixed auth)
  app.route("/shares", getShare);
  app.route("/shares/:slug", sharesSlug);
  app.route("/shares/:slug/unlock", sharesUnlock);
  app.route("/shares/:slug/set-password", sharesSetPassword);

  // Invite routes (cookie auth)
  app.route("/invite", inviteGetDetails);
  app.route("/invite/accept", inviteAccept);
  app.route("/invite/decline", inviteDecline);

  // Content operation routes (cookie auth)
  app.route("/upload", upload);
  app.route("/images/upload", imagesUpload);
  app.route("/publish", publish);
  app.route("/search", search);

  // Analytics + Meta routes (public)
  app.route("/analytics/track", analyticsTrack);
  app.route("/oembed", oembed);

  return app;
}
