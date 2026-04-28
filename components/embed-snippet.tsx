"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Code, Copy, Check } from "lucide-react";

interface EmbedSnippetProps {
  slug: string;
}

export function EmbedSnippet({ slug }: EmbedSnippetProps) {
  const [copied, setCopied] = useState(false);
  const embedCode = `<iframe src="${window.location.origin}/embed/${slug}" width="600" height="400" frameborder="0" loading="lazy" title="DropItX Embed"></iframe>`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Code className="size-3" />
        Embed
      </label>
      <div className="flex items-center gap-2">
        <Input
          value={embedCode}
          readOnly
          className="font-mono text-xs"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
    </div>
  );
}
