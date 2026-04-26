"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";

export interface UploadResult {
  slug: string;
  url: string;
  filename: string;
  deleteToken: string;
}

interface UploadDropzoneProps {
  onUploadSuccess: (result: UploadResult) => void;
}

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error";

const MAX_SIZE = 50 * 1024 * 1024;

export function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setState("uploading");
      setErrorMessage("");

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          setState("error");
          setErrorMessage(data.error || "Upload failed.");
          return;
        }

        setState("success");
        const ext = file.name.split(".").pop()?.toLowerCase() as "html" | "htm" | "md";
        trackEvent(AnalyticsEvent.DOCUMENT_UPLOADED, {
          type: ext === "md" ? "md" : "html",
          size_kb: Math.round(file.size / 1024),
        });
        onUploadSuccess(data as UploadResult);
      } catch {
        setState("error");
        setErrorMessage("Network error. Please try again.");
      }
    },
    [onUploadSuccess],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      void uploadFile(acceptedFiles[0]);
    },
    [uploadFile],
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDropAccepted: () => setDragActive(false),
    onDropRejected: () => {
      setDragActive(false);
      setState("error");
      setErrorMessage("Only .html/.htm/.md files under 50MB are accepted.");
    },
    accept: { "text/html": [".html", ".htm"], "text/markdown": [".md"] },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: state === "uploading",
    noClick: state === "uploading",
  });

  const stateIcon = () => {
    const base = "size-10 transition-all duration-200";
    switch (state) {
      case "uploading":
        return <Loader2 className={`${base} animate-spin text-primary`} />;
      case "success":
        return (
          <div className="animate-scale-in">
            <CheckCircle2 className={`${base} text-green-600 dark:text-green-400`} />
          </div>
        );
      case "error":
        return <XCircle className={`${base} text-destructive`} />;
      default:
        return dragActive ? (
          <FileUp className={`${base} text-primary scale-110`} />
        ) : (
          <Upload className={`${base} text-muted-foreground`} />
        );
    }
  };

  const stateText = () => {
    switch (state) {
      case "uploading":
        return "Uploading...";
      case "success":
        return "Upload complete!";
      case "error":
        return errorMessage;
      default:
        return dragActive
          ? "Drop your file here"
          : "Drag & drop an HTML or Markdown file, or click to browse";
    }
  };

  const cardClasses = [
    "cursor-pointer transition-all duration-200",
    state === "idle" && !dragActive
      ? "border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/[0.02]"
      : "",
    dragActive
      ? "border-primary border-2 ring-2 ring-primary/20 bg-primary/[0.03] scale-[1.02]"
      : "",
    state === "error"
      ? "border-destructive/50 border-2 bg-destructive/[0.02]"
      : "",
    state === "success"
      ? "border-green-500/50 border-2 bg-green-50 dark:bg-green-950/20"
      : "",
    state === "uploading"
      ? "border-primary/30 border-2 cursor-wait"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card {...getRootProps()} className={cardClasses}>
      <CardContent className="flex flex-col items-center justify-center gap-5 py-14">
        {/* Shimmer overlay while uploading */}
        {state === "uploading" && (
          <div
            className="absolute inset-0 rounded-xl animate-shimmer pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(37,99,235,0.06) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
            }}
            aria-hidden="true"
          />
        )}

        <div className="relative">{stateIcon()}</div>

        <p
          className={`text-center text-sm transition-colors duration-200 ${
            state === "error"
              ? "text-destructive"
              : state === "uploading"
                ? "text-primary/70"
                : "text-muted-foreground"
          }`}
        >
          {stateText()}
        </p>

        {state === "idle" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            Choose file
          </Button>
        )}
        {state === "success" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setState("idle");
            }}
          >
            Upload another
          </Button>
        )}
        {state === "error" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setState("idle");
            }}
          >
            Try again
          </Button>
        )}
      </CardContent>
      <input {...getInputProps()} />
    </Card>
  );
}
