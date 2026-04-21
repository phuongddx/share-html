import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { HtmlViewer } from "@/components/html-viewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Share } from "@/types/share";

interface SharePageProps {
  params: Promise<{ slug: string }>;
}

function formatExpiresIn(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return "Expired";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 0) return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  return `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
}

function formatUploadDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SharePage({ params }: SharePageProps) {
  const { slug } = await params;
  const supabase = createServerClient();

  // Lookup share by slug
  const { data: share, error: fetchError } = await supabase
    .from("shares")
    .select("*")
    .eq("slug", slug)
    .single<Share>();

  if (fetchError || !share) {
    notFound();
  }

  // Check expiration
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    notFound();
  }

  // Increment view count atomically via RPC
  const { data: newCount } = await supabase.rpc("increment_view_count", {
    share_slug: slug,
  });
  const viewCount = typeof newCount === "number" ? newCount : share.view_count + 1;

  // Fetch HTML content from storage
  const { data: fileData, error: storageError } = await supabase.storage
    .from("html-files")
    .download(share.storage_path);

  if (storageError || !fileData) {
    notFound();
  }

  const htmlContent = await fileData.text();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Metadata header */}
      <Card>
        <CardHeader>
          <CardTitle className="truncate">{share.filename}</CardTitle>
          <CardDescription className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>Uploaded {formatUploadDate(share.created_at)}</span>
            <span>{viewCount} views</span>
            {share.expires_at && (
              <span>Expires in {formatExpiresIn(share.expires_at)}</span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* HTML viewer */}
      <Card>
        <CardContent className="p-2">
          <HtmlViewer htmlContent={htmlContent} />
        </CardContent>
      </Card>
    </div>
  );
}
