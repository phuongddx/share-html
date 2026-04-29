"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isValidTeamName, isValidTeamSlug } from "@/lib/team-utils";

interface TeamData {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

export default function TeamSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState<string>("");
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fetchedRef = useRef<string>("");

  // Extract slug from params
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  // Fetch team data when slug changes
  useEffect(() => {
    if (!slug || fetchedRef.current === slug) return;
    fetchedRef.current = slug;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/teams/${slug}`);
        if (cancelled) return;
        if (!res.ok) throw new Error("Failed to load team");
        const data = await res.json();
        setTeam(data);
        setName(data.name);
        setEditSlug(data.slug);
      } catch {
        if (!cancelled) toast.error("Failed to load team settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;

    const trimmedName = name.trim();
    const trimmedSlug = editSlug.trim();

    if (!isValidTeamName(trimmedName)) {
      toast.error("Invalid team name (1-100 chars)");
      return;
    }
    if (!isValidTeamSlug(trimmedSlug)) {
      toast.error("Invalid slug (2-50 chars, lowercase alphanumeric + hyphens)");
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (trimmedName !== team.name) updates.name = trimmedName;
      if (trimmedSlug !== team.slug) updates.slug = trimmedSlug;

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/dashboard/teams/${team.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update team");

      toast.success("Team settings updated");
      if (updates.slug) {
        router.push(`/dashboard/teams/${updates.slug}/settings`);
      } else {
        fetchedRef.current = "";
        setLoading(true);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update team");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!team) return;
    if (
      !confirm(
        `Delete team "${team.name}"? This removes all members and team share associations. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/teams/${team.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete team");
      }
      toast.success("Team deleted");
      router.push("/dashboard/teams");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Team not found or you don&apos;t have permission to view settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[680px]">
      <div>
        <Link
          href={`/dashboard/teams/${slug}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-3" />
          Back to Team
        </Link>
        <h1 className="text-2xl font-bold">Team Settings</h1>
      </div>

      {/* General settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="team-name" className="text-sm font-medium">
                Team Name
              </label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="h-10 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="team-slug" className="text-sm font-medium">
                Slug
              </label>
              <Input
                id="team-slug"
                value={editSlug}
                onChange={(e) =>
                  setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                maxLength={50}
                className="h-10 rounded-md"
              />
              <p className="text-xs text-muted-foreground">
                Changing the slug will change the team URL.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Plan</p>
              <Badge variant="secondary">{team.plan}</Badge>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="submit" disabled={saving} className="rounded-md">
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting this team will remove all member associations and team share links.
            Personal shares will not be deleted.
          </p>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete Team
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
