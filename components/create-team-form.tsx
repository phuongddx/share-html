"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isValidTeamName, isValidTeamSlug } from "@/lib/team-utils";

/** Auto-generates a slug from a name (mirrors server-side logic without random suffix). */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const autoSlug = useMemo(() => nameToSlug(name), [name]);
  const displaySlug = slugEdited ? slug : autoSlug;

  const nameValid = isValidTeamName(name);
  const slugValid = isValidTeamSlug(displaySlug);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const finalSlug = slugEdited ? slug.trim() : autoSlug;

    if (!isValidTeamName(trimmedName)) {
      toast.error("Team name must be 1-100 characters");
      return;
    }
    if (!isValidTeamSlug(finalSlug)) {
      toast.error("Slug must be 2-50 chars, lowercase letters, numbers, and hyphens");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, slug: finalSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team");

      toast.success(`Team "${trimmedName}" created`);
      router.push(`/dashboard/teams/${data.team.slug}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" />
          New Team
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="team-name" className="text-sm font-medium">
              Team Name
            </label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering, Design Team"
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
              value={displaySlug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              placeholder="team-slug"
              maxLength={50}
              className="h-10 rounded-md"
            />
            <p className="text-xs text-muted-foreground">
              URL: /dashboard/teams/{displaySlug || "..."}
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !nameValid || !slugValid}
              className="rounded-md"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Create Team"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
