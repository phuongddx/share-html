"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { Check, Copy, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";

interface EditorPublishBarProps {
  content: string;
  isDirty: boolean;
  mode: "create" | "edit";
  editSlug?: string;
  editTitle?: string;
  onPublished?: (slug: string, url: string) => void;
  onClearDraft?: () => void;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function EditorPublishBar({
  content,
  isDirty,
  mode,
  editSlug,
  editTitle,
  onPublished,
  onClearDraft,
}: EditorPublishBarProps) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id });
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Content cannot be empty.");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          is_private: isPrivate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Publishing failed");
      }

      const data = await res.json();
      setPublishedUrl(data.url);
      toast.success("Published successfully!");
      trackEvent(AnalyticsEvent.CONTENT_PUBLISHED, { is_private: isPrivate });
      onPublished?.(data.slug, data.url);
      onClearDraft?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publishing failed");
    } finally {
      setPublishing(false);
    }
  }, [content, isPrivate, onPublished, onClearDraft]);

  const handleUpdate = useCallback(async () => {
    if (!editSlug || !content.trim()) return;

    setPublishing(true);
    try {
      const res = await fetch(`/api/shares/${editSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, is_private: isPrivate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Update failed");
      }

      const data = await res.json();
      toast.success("Updated successfully!");
      onPublished?.(editSlug, data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPublishing(false);
    }
  }, [editSlug, content, isPrivate, onPublished]);

  const copyUrl = useCallback(async () => {
    if (!publishedUrl) return;
    await navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [publishedUrl]);

  const charCount = content.length;
  const wordCount = countWords(content);
  const readingTime = wordCount > 0 ? Math.ceil(wordCount / 200) : 0;

  return (
    <div className="sticky bottom-0 z-20 flex items-center justify-between border-t bg-background px-4 py-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{charCount.toLocaleString()} chars</span>
        <span>{wordCount.toLocaleString()} words</span>
        {readingTime > 0 && <span>{readingTime} min read</span>}
        {isDirty && !publishedUrl && (
          <span className="text-amber-500">Unsaved</span>
        )}
        {mode === "edit" && editTitle && (
          <Badge variant="outline" className="text-xs">
            Editing: {editTitle}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Privacy toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsPrivate(!isPrivate)}
          title={isPrivate ? "Make public" : "Make private"}
        >
          {isPrivate ? (
            <Lock className="size-4 text-amber-500" />
          ) : (
            <Unlock className="size-4 text-muted-foreground" />
          )}
        </Button>

        {publishedUrl ? (
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs max-w-[200px] truncate">
              {publishedUrl}
            </code>
            <Button size="icon-sm" variant="outline" onClick={copyUrl}>
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </Button>
          </div>
        ) : !user ? (
          <a href="/auth/login?redirect=/editor">
            <Button size="sm">Sign in to publish</Button>
          </a>
        ) : (
          <Button
            size="sm"
            disabled={publishing || !content.trim()}
            onClick={mode === "edit" ? handleUpdate : handlePublish}
          >
            {publishing && <Loader2 className="mr-1 size-3 animate-spin" />}
            {mode === "edit" ? "Update" : "Publish"}
          </Button>
        )}
      </div>
    </div>
  );
}
