"use client";

import { useState } from "react";
import { UploadDropzone, type UploadResult } from "@/components/upload-dropzone";
import { ShareLink } from "@/components/share-link";
import { SearchBar } from "@/components/search-bar";

export function HomePage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background">
      <main className="flex w-full max-w-[680px] mx-auto flex-col items-center gap-8 px-6 py-24">
        {/* Hero heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-mono text-4xl md:text-5xl font-bold tracking-tight">
            <span className="text-muted-foreground">&gt;</span>{" "}
            <span className="text-primary">dropitx</span>
          </h1>
          <p className="text-muted-foreground text-base max-w-md">
            Instant file drops, shareable links.
          </p>
        </div>

        {/* Upload area */}
        <div className="w-full">
          <UploadDropzone onUploadSuccess={setUploadResult} />
        </div>

        {/* Share link result */}
        {uploadResult && (
          <div className="w-full animate-slide-up">
            <ShareLink result={uploadResult} />
          </div>
        )}

        {/* Search */}
        <div className="w-full mt-4">
          <SearchBar compact />
        </div>
      </main>

      {/* Footer */}
      <footer className="pb-6 text-xs text-muted-foreground">
        DropItX &mdash; Instant file drops, shareable links.
      </footer>
    </div>
  );
}
