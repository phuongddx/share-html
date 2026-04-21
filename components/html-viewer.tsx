"use client";

import { useEffect, useRef, useState } from "react";

interface HtmlViewerProps {
  htmlContent: string;
}

const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\' \'unsafe-eval\'; img-src data: blob:;">';

function injectCsp(html: string): string {
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>${CSP_META}`);
  }
  return `${CSP_META}${html}`;
}

export function HtmlViewer({ htmlContent }: HtmlViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source === iframeRef.current?.contentWindow &&
        event.data?.type === "error"
      ) {
        setError(
          typeof event.data.message === "string"
            ? event.data.message
            : "Failed to render HTML content",
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (error) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
        <p className="text-sm text-destructive">
          Rendering error: {error}
        </p>
      </div>
    );
  }

  const safeContent = injectCsp(htmlContent);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={safeContent}
      sandbox="allow-scripts"
      title="Shared HTML content"
      className="h-[80vh] w-full rounded-lg border ring-1 ring-foreground/10"
      scrolling="auto"
    />
  );
}
