"use client";

import { useState } from "react";
import { createClient } from "@dropitx/shared/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm`,
    });
    // Always show success to prevent email enumeration
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-mono text-2xl font-semibold">
            <span className="text-muted-foreground">&gt;</span>{" "}
            <span className="text-primary">reset password</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {sent
              ? "Check your email for a reset link"
              : "Enter your email to receive a reset link"}
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-md bg-primary/10 p-4 text-center text-sm text-primary">
              We&apos;ve sent a password reset link to{" "}
              <strong>{email}</strong>. Please check your inbox.
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = "/auth/login")}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-[#F5F7F9] dark:bg-input/30"
                autoComplete="email"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-[#1A1C21] text-white hover:bg-[#1A1C21]/90"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <a
                href="/auth/login"
                className="text-primary hover:underline"
              >
                Sign in
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
