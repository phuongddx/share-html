import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Heart } from "lucide-react";
import { DashboardShareCard } from "@/components/dashboard-share-card";
import type { Share } from "@/types/share";

interface FavoriteRow {
  share_id: string;
  created_at: string;
  shares: Share | null;
}

export default async function FavoritesPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: favorites } = await supabase
    .from("favorites")
    .select("share_id, created_at, shares(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favList = (favorites ?? []) as unknown as FavoriteRow[];
  const shares = favList.map((f) => f.shares).filter((s): s is Share => !!s);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Favorites</h1>

      {shares.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Heart className="size-12 mx-auto mb-3 opacity-50" />
          <p>No favorites yet. Heart a share to save it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shares.map((share) => (
            <DashboardShareCard key={share.id} share={share} />
          ))}
        </div>
      )}
    </div>
  );
}
