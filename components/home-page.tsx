"use client";

/**
 * HomePage — client shell for the landing page.
 * Manages upload result state and renders UploadDropzone + ShareLink.
 */

import { useState } from "react";
import { UploadDropzone, type UploadResult } from "@/components/upload-dropzone";
import { ShareLink } from "@/components/share-link";
import { SearchBar } from "@/components/search-bar";

export function HomePage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 px-6 py-20">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Share HTML
          </h1>
          <p className="text-muted-foreground">
            Drop an HTML file, get a short link
          </p>
        </div>

        <div className="w-full">
          <UploadDropzone onUploadSuccess={setUploadResult} />
        </div>

        {uploadResult && (
          <div className="w-full">
            <ShareLink result={uploadResult} />
          </div>
        )}

        <div className="w-full mt-8">
          <SearchBar compact />
        </div>
      </main>
    </div>
  );
}
