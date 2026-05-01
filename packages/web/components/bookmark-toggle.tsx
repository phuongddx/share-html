"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@dropitx/shared/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

interface BookmarkToggleProps {
  shareId: string;
  slug: string;
}

export function BookmarkToggle({ shareId, slug }: BookmarkToggleProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const toggling = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("share_id", shareId)
        .maybeSingle();
      setIsFavorited(!!data);
      setLoading(false);
    })();
  }, [shareId]);

  const toggle = useCallback(async () => {
    if (toggling.current) return;
    if (!userId) {
      router.push(`/auth/login?next=/s/${slug}`);
      return;
    }

    toggling.current = true;
    const supabase = createClient();
    const prev = isFavorited;
    setIsFavorited(!prev);

    let error: string | null = null;
    if (prev) {
      const { error: delErr } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("share_id", shareId);
      error = delErr?.message ?? null;
    } else {
      const { error: insErr } = await supabase
        .from("favorites")
        .insert({ user_id: userId, share_id: shareId });
      error = insErr?.message ?? null;
    }

    if (error) { setIsFavorited(prev); }
    toggling.current = false;
  }, [isFavorited, shareId, slug, userId, router]);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      disabled={loading}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={`size-4 transition-colors duration-200 ${isFavorited ? "text-destructive fill-destructive" : ""}`}
      />
    </Button>
  );
}
