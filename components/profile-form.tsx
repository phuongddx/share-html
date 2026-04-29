"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProfileFormProps {
  userId: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  providers: string[];
}

export function ProfileForm({
  userId,
  displayName,
  avatarUrl,
  email,
  providers,
}: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const initial = (name || email || "U")[0].toUpperCase();

  async function handleSave() {
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) {
      toast.error("Display name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("user_profiles")
        .upsert(
          { id: userId, display_name: trimmed },
          { onConflict: "id" },
        );
      if (error) throw error;
      setName(trimmed);
      toast.success("Profile updated");
      router.refresh();
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      toast.error("Failed to sign out");
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-16 rounded-md"
              />
            ) : (
              <div className="size-16 rounded-md bg-primary flex items-center justify-center text-white text-xl font-bold">
                {initial}
              </div>
            )}
            <div>
              <p className="font-medium">{name || email}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <label htmlFor="display-name" className="text-sm font-medium">
              Display Name
            </label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
                maxLength={100}
              />
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          {/* Connected providers */}
          {providers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Connected Providers</p>
              <div className="flex gap-2">
                {providers.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button variant="outline" onClick={handleSignOut} disabled={signingOut}>
        {signingOut ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        Sign Out
      </Button>
    </div>
  );
}
