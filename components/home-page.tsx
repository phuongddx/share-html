"use client";

import { useState } from "react";
import { UploadDropzone, type UploadResult } from "@/components/upload-dropzone";
import { ShareLink } from "@/components/share-link";
import { SearchBar } from "@/components/search-bar";

export function HomePage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background relative">
      {/* Decorative gradient orb */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full blur-[120px] opacity-25 dark:opacity-10 bg-gradient-to-br from-violet-600 to-violet-400"
        aria-hidden="true"
      />

      <main className="relative flex w-full max-w-2xl flex-col items-center gap-10 px-6 py-24">
        {/* Hero heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="font-mono text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            [x]{" "}
            <span className="bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">
              dropitx
            </span>
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
      <footer className="relative pb-6 text-xs text-muted-foreground/60">
        DropItX &mdash; Instant file drops, shareable links.
      </footer>
    </div>
  );
}
