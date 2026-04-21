"use client";

/**
 * UploadDropzone — drag-and-drop or click-to-browse HTML file upload widget.
 * Uses react-dropzone with visual states: idle, dragging, uploading, success, error.
 */

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileUp, Loader2, CheckCircle2, XCircle } from "lucide-react";

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

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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
      setErrorMessage("Only .html/.htm files under 10MB are accepted.");
    },
    accept: { "text/html": [".html", ".htm"] },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: state === "uploading",
    noClick: state === "uploading",
  });

  const stateIcon = () => {
    switch (state) {
      case "uploading":
        return <Loader2 className="size-10 animate-spin text-muted-foreground" />;
      case "success":
        return <CheckCircle2 className="size-10 text-green-600" />;
      case "error":
        return <XCircle className="size-10 text-destructive" />;
      default:
        return dragActive ? (
          <FileUp className="size-10 text-primary" />
        ) : (
          <Upload className="size-10 text-muted-foreground" />
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
          ? "Drop your HTML file here"
          : "Drag & drop an HTML file here, or click to browse";
    }
  };

  return (
    <Card
      {...getRootProps()}
      className={`cursor-pointer transition-colors ${
        dragActive
          ? "border-primary bg-primary/5"
          : state === "error"
            ? "border-destructive"
            : state === "success"
              ? "border-green-600"
              : "hover:border-ring"
      }`}
    >
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
        {stateIcon()}
        <p
          className={`text-center text-sm ${
            state === "error" ? "text-destructive" : "text-muted-foreground"
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
