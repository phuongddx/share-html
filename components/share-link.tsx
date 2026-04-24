"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SharePasswordForm } from "@/components/share-password-form";
import { Check, Copy, ExternalLink, Trash2, AlertTriangle, Lock } from "lucide-react";
import type { UploadResult } from "@/components/upload-dropzone";

interface ShareLinkProps {
  result: UploadResult;
}

export function ShareLink({ result }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const [deleteShown, setDeleteShown] = useState(true);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${result.slug}` : `/s/${result.slug}`;
  const deleteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/shares/${result.slug}`
      : `/api/shares/${result.slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.getElementById("share-url-input") as HTMLInputElement;
      input?.select();
    }
  };

  return (
    <Card className="animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Check className="size-4 text-green-600 dark:text-green-400" />
          File shared successfully
        </CardTitle>
        <CardDescription>{result.filename}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Shareable URL */}
        <div className="flex items-center gap-2">
          <Input
            id="share-url-input"
            value={shareUrl}
            readOnly
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant={copied ? "default" : "outline"}
            size="icon"
            onClick={handleCopy}
            aria-label="Copy share link"
            className="shrink-0"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open share link"
          >
            <Button type="button" variant="outline" size="icon" className="shrink-0">
              <ExternalLink className="size-4" />
            </Button>
          </a>
        </div>

        {/* Inline copied feedback */}
        {copied && (
          <p className="text-xs text-green-600 dark:text-green-400 animate-fade-in">
            Link copied to clipboard
          </p>
        )}

        {/* Delete link */}
        {deleteShown && (
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-800/30 dark:bg-amber-950/20 transition-colors">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              Save this delete link — it will not be shown again
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="delete-url-input"
                value={`${deleteUrl}`}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(deleteUrl);
                  } catch {
                    const input = document.getElementById(
                      "delete-url-input",
                    ) as HTMLInputElement;
                    input?.select();
                  }
                }}
                aria-label="Copy delete link"
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="mt-2 text-amber-600 dark:text-amber-400"
              onClick={() => setDeleteShown(false)}
            >
              <Trash2 className="size-3" />
              Dismiss
            </Button>
          </div>
        )}
        {/* Password protection — available for anonymous uploads via delete_token */}
        {result.deleteToken && (
          <div className="rounded-lg border p-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPasswordOpen((o) => !o)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              <Lock className="size-4 shrink-0" />
              {hasPassword ? "Password set — click to change" : "Add password protection"}
            </button>
            {passwordOpen && (
              <SharePasswordForm
                slug={result.slug}
                deleteToken={result.deleteToken}
                hasPassword={hasPassword}
                onSuccess={(hp) => {
                  setHasPassword(hp);
                  if (!hp) setPasswordOpen(false);
                }}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
