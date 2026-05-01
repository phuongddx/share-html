import { AlertCircle, CheckCircle, Clock, Mail } from "lucide-react";

type InviteStatusVariant =
  | "not_found"
  | "already_used"
  | "expired"
  | "email_mismatch"
  | "not_logged_in"
  | "invite_info";

interface InviteStatusCardProps {
  variant: InviteStatusVariant;
  message?: string;
  subMessage?: string;
  inviteEmail?: string;
  currentUserEmail?: string;
  loginUrl?: string;
  signupUrl?: string;
  children?: React.ReactNode;
}

const VARIANT_CONFIG: Record<
  InviteStatusVariant,
  { icon: typeof AlertCircle; iconColor: string; title: string }
> = {
  not_found: {
    icon: AlertCircle,
    iconColor: "text-destructive",
    title: "Invite Not Found",
  },
  already_used: {
    icon: CheckCircle,
    iconColor: "text-green-500",
    title: "Invite Already Used",
  },
  expired: {
    icon: Clock,
    iconColor: "text-destructive",
    title: "Invite Expired",
  },
  email_mismatch: {
    icon: Mail,
    iconColor: "text-destructive",
    title: "Email Mismatch",
  },
  not_logged_in: {
    icon: Mail,
    iconColor: "text-blue-500",
    title: "Accept Team Invite",
  },
  invite_info: {
    icon: Mail,
    iconColor: "text-blue-500",
    title: "Accept Team Invite",
  },
};

export function InviteStatusCard({
  variant,
  message,
  subMessage,
  inviteEmail,
  currentUserEmail,
  loginUrl,
  signupUrl,
  children,
}: InviteStatusCardProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-sm rounded-lg border border-border bg-card p-8 text-center">
        <h1
          className={`text-xl font-semibold ${config.iconColor}`}
        >
          {config.title}
        </h1>
        {message && (
          <p className="mt-2 text-muted-foreground">{message}</p>
        )}
        {inviteEmail && (
          <p className="mt-2 text-sm text-muted-foreground">
            Invite sent to <strong>{inviteEmail}</strong>
            {currentUserEmail && (
              <>
                {" "}
                — logged in as <strong>{currentUserEmail}</strong>
              </>
            )}
          </p>
        )}
        {subMessage && (
          <p className="mt-2 text-sm text-muted-foreground">
            {subMessage}
          </p>
        )}
        {loginUrl && !signupUrl && (
          <a
            href={loginUrl}
            className="mt-6 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Log In to Accept
          </a>
        )}
        {loginUrl && signupUrl && (
          <div className="mt-6 flex flex-col gap-2">
            <a
              href={loginUrl}
              className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Log In to Accept
            </a>
            <a
              href={signupUrl}
              className="inline-block rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Sign Up to Accept
            </a>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
