import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { HtmlViewer } from "@/components/html-viewer";
import { MarkdownViewerWrapper } from "@/components/markdown-viewer-wrapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookmarkToggle } from "@/components/bookmark-toggle";
import { FileCode, FileText, Eye, Clock, Calendar } from "lucide-react";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SharePage({ params }: SharePageProps) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: share, error: fetchError } = await supabase
    .from("shares")
    .select("*")
    .eq("slug", slug)
    .single<Share>();

  if (fetchError || !share) {
    notFound();
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    notFound();
  }

  const { data: newCount } = await supabase.rpc("increment_view_count", {
    share_slug: slug,
  });
  const viewCount = typeof newCount === "number" ? newCount : share.view_count + 1;

  const { data: fileData, error: storageError } = await supabase.storage
    .from("html-files")
    .download(share.storage_path);

  if (storageError || !fileData) {
    notFound();
  }

  const fileContent = await fileData.text();
  const isMarkdown = share.mime_type === "text/markdown";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 max-w-5xl mx-auto w-full animate-fade-in">
      {/* Metadata header */}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                {isMarkdown ? (
                  <FileText className="size-5 text-violet-500" />
                ) : (
                  <FileCode className="size-5 text-blue-500" />
                )}
              </div>
              <CardTitle className="truncate text-lg">{share.filename}</CardTitle>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline">
                {isMarkdown ? "Markdown" : "HTML"}
              </Badge>
              <BookmarkToggle shareId={share.id} slug={share.slug} />
            </div>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatUploadDate(share.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {viewCount} views
            </span>
            {share.file_size && (
              <span>{formatFileSize(share.file_size)}</span>
            )}
            {share.expires_at && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                Expires in {formatExpiresIn(share.expires_at)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* File viewer */}
      <Card>
        <CardContent className={isMarkdown ? "p-4 md:p-6" : "p-2"}>
          {isMarkdown ? (
            <MarkdownViewerWrapper content={fileContent} />
          ) : (
            <HtmlViewer htmlContent={fileContent} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
