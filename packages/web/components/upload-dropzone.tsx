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
            <CheckCircle2 className={`${base} text-success`} />
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
    "cursor-pointer transition-colors duration-200",
    state === "idle" && !dragActive
      ? "border-dashed border-2 border-border hover:border-primary/50"
      : "",
    dragActive
      ? "border-solid border-2 border-primary bg-primary/[0.03]"
      : "",
    state === "error"
      ? "border-2 border-destructive/50 bg-destructive/[0.03]"
      : "",
    state === "success"
      ? "border-2 border-success/50 bg-success/[0.03]"
      : "",
    state === "uploading"
      ? "border-2 border-primary/30 animate-border-pulse cursor-wait"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card {...getRootProps()} className={cardClasses}>
      <CardContent className="flex flex-col items-center justify-center gap-5 py-14">
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
