"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isValidRedirect(path: string | null): boolean {
  if (!path) return false;
  return (path.startsWith("/s/") || path.startsWith("/invite/")) && !path.includes("//") && !path.includes("\\");
}

function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const isShareRedirect = isValidRedirect(nextPath);
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === "confirmation_failed"
      ? "Email confirmation failed. Please try again."
      : null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectTo = (() => {
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (isShareRedirect && nextPath) {
      callbackUrl.searchParams.set("next", nextPath);
    }
    return callbackUrl.toString();
  })();

  const login = async (provider: "google" | "github") => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  };

  const handleEmailSignIn = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      window.location.href = isShareRedirect && nextPath ? nextPath : "/dashboard";
    }
  };

  const handleEmailSignUp = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const confirmUrl = new URL("/auth/confirm", window.location.origin);
    if (isShareRedirect && nextPath) {
      confirmUrl.searchParams.set("next", nextPath);
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: confirmUrl.toString() },
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccessMessage("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") handleEmailSignIn();
    else handleEmailSignUp();
  };

  return (
    <div className="flex min-h-screen">
      {/* Form Side */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold tracking-tight">
              <span className="text-muted-foreground">&gt;</span> DropItX
            </span>
          </div>

          {/* Mode Toggle Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                mode === "signin"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to your account"
                : "Sign up to get started"}
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
              {successMessage}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Email/Password Form */}
          {!successMessage && (
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

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-11 bg-[#F5F7F9] pr-12 dark:bg-input/30"
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {mode === "signin" && (
                <div className="text-right">
                  <a
                    href="/auth/reset-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full bg-[#1A1C21] text-white hover:bg-[#1A1C21]/90"
              >
                {loading
                  ? "Please wait..."
                  : mode === "signin"
                    ? "Sign In"
                    : "Create Account"}
              </Button>
            </form>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="h-11 flex-1 gap-2"
              onClick={() => login("google")}
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1 gap-2"
              onClick={() => login("github")}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </Button>
          </div>

          {/* Mode switch footer */}
          {mode === "signin" ? (
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-primary hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Branding Side */}
      <div
        className="hidden items-center justify-center bg-gradient-to-br from-[#3B6FD4] via-[#1E3A7B] to-[#152952] p-12 md:flex"
        style={{ flex: "0 0 50%" }}
      >
        <div className="space-y-8 text-white">
          {/* Geometric decoration */}
          <div className="relative h-32 w-32">
            <div className="absolute left-4 top-0 size-16 rotate-45 rounded-lg bg-white/10" />
            <div className="absolute bottom-0 right-0 size-12 rounded-full bg-[#F49B42]/30" />
            <div className="absolute bottom-4 left-0 size-8 rounded-full bg-white/20" />
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight">
              Drop.
              <br />
              <span className="text-[#F49B42]">Share.</span>
              <br />
              Collaborate.
            </h2>
            <p className="text-sm text-white/70">
              Share HTML &amp; Markdown files with short, shareable links.
            </p>
          </div>

          {/* Dot pattern */}
          <div className="flex gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="size-1.5 rounded-full bg-white/30"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
