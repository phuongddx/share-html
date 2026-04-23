import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardShareCard } from "@/components/dashboard-share-card";
import { FileText, Eye, HardDrive } from "lucide-react";
import type { Share } from "@/types/share";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: shares } = await supabase
    .from("shares")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const shareList: Share[] = shares ?? [];
  const totalShares = shareList.length;
  const totalViews = shareList.reduce((sum, s) => sum + s.view_count, 0);
  const totalSize = shareList.reduce((sum, s) => sum + (s.file_size ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="size-4" />
            Shares
          </div>
          <p className="text-2xl font-bold mt-1">{totalShares}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Eye className="size-4" />
            Views
          </div>
          <p className="text-2xl font-bold mt-1">{totalViews}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <HardDrive className="size-4" />
            Storage
          </div>
          <p className="text-2xl font-bold mt-1">{formatFileSize(totalSize)}</p>
        </div>
      </div>

      {/* Share list */}
      {shareList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="size-12 mx-auto mb-3 opacity-50" />
          <p>No shares yet. Upload a file to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shareList.map((share) => (
            <DashboardShareCard key={share.id} share={share} />
          ))}
        </div>
      )}
    </div>
  );
}
