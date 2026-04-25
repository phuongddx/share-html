"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SharePasswordForm } from "@/components/share-password-form";
import { Eye, Clock, Trash2, ExternalLink, FileCode, FileText, Lock, LockOpen } from "lucide-react";
import type { ShareWithPasswordFlag } from "@/app/dashboard/page";

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

export function DashboardShareCard({ share }: { share: ShareWithPasswordFlag }) {
  const [deleting, setDeleting] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState(share.has_password);
  const isMarkdown = share.mime_type === "text/markdown";

  const handleDelete = async () => {
    if (!confirm("Delete this share? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shares/${share.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      window.location.reload();
    } catch {
      alert("Failed to delete share.");
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-0 p-0">
        <div className="flex items-center gap-4 p-4">
          <div className="shrink-0">
            {isMarkdown ? (
              <FileText className="size-5 text-violet-500" />
            ) : (
              <FileCode className="size-5 text-violet-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{share.title || share.filename}</p>
              <Badge variant="outline" className="shrink-0 text-xs">
                {isMarkdown ? "MD" : "HTML"}
              </Badge>
              {hasPassword && (
                <Lock className="size-3 text-muted-foreground shrink-0" />
              )}
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
              {share.file_size != null && <span>{formatFileSize(share.file_size)}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPasswordOpen((o) => !o)}
              title={hasPassword ? "Manage password" : "Add password"}
            >
              {hasPassword ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
            </Button>
            <Link href={`/s/${share.slug}`} target="_blank">
              <Button variant="ghost" size="icon-sm">
                <ExternalLink className="size-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {passwordOpen && (
          <div className="border-t px-4 pb-4 pt-3">
            <SharePasswordForm
              slug={share.slug}
              hasPassword={hasPassword}
              onSuccess={(hp) => {
                setHasPassword(hp);
                if (!hp) setPasswordOpen(false);
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
