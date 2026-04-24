"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface SharePasswordFormProps {
  slug: string;
  deleteToken?: string;
  hasPassword?: boolean;
  onSuccess?: (hasPassword: boolean) => void;
}

export function SharePasswordForm({
  slug,
  deleteToken,
  hasPassword = false,
  onSuccess,
}: SharePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (passwordValue: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shares/${slug}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: passwordValue,
          ...(deleteToken ? { delete_token: deleteToken } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update password.");
        return;
      }
      toast.success(passwordValue ? "Password set" : "Password removed");
      setPassword("");
      setConfirm("");
      onSuccess?.(data.has_password);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    await submit(password);
  };

  const handleRemove = async () => {
    if (!window.confirm("Remove password protection from this share?")) return;
    await submit(null);
  };

  return (
    <form onSubmit={handleSet} className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4 shrink-0" />
        Password Protection
      </div>

      <Input
        type="password"
        placeholder="New password (min 4 chars)..."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        autoComplete="new-password"
      />
      <Input
        type="password"
        placeholder="Confirm password..."
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={loading}
        autoComplete="new-password"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={loading || !password}>
          {loading ? <Loader2 className="size-3 animate-spin" /> : null}
          Set Password
        </Button>
        {hasPassword && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={handleRemove}
            className="text-destructive hover:text-destructive"
          >
            Remove
          </Button>
        )}
      </div>
    </form>
  );
}
