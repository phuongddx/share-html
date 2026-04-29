"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Clock, FileText, FileCode, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Share } from "@/types/share";

interface TeamShareCardProps {
  share: Share;
  sharedByName?: string;
  teamName: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
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

/** Share card variant for team context — read-only view with team badge. */
export function TeamShareCard({ share, sharedByName, teamName }: TeamShareCardProps) {
  const isMarkdown = share.mime_type === "text/markdown";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="shrink-0">
          {isMarkdown ? (
            <FileText className="size-5 text-primary" />
          ) : (
            <FileCode className="size-5 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">
              {share.title || share.filename}
            </p>
            <Badge variant="outline" className="shrink-0 text-xs">
              {isMarkdown ? "MD" : "HTML"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDate(share.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {share.view_count}
            </span>
            {share.file_size != null && (
              <span>{formatFileSize(share.file_size)}</span>
            )}
          </div>
          {(sharedByName || teamName) && (
            <p className="text-xs text-muted-foreground mt-1">
              {sharedByName && `Shared by ${sharedByName}`}
              {sharedByName && teamName && " · "}
              {teamName && `in ${teamName}`}
            </p>
          )}
        </div>

        <Link href={`/s/${share.slug}`} target="_blank" className="shrink-0">
          <Badge variant="secondary" className="text-xs">
            <ExternalLink className="size-3 mr-1" />
            Open
          </Badge>
        </Link>
      </CardContent>
    </Card>
  );
}
