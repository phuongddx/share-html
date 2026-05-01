import { Heart } from "lucide-react";
import { DashboardShareCard } from "@/components/dashboard-share-card";
import { apiClient } from "@/lib/api-client";
import type { ShareWithPasswordFlag } from "@dropitx/shared/types/share";

export default async function FavoritesPage() {
  const shares = await apiClient<ShareWithPasswordFlag[]>("/dashboard/favorites");

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-lg font-semibold">Favorites</h1>

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
