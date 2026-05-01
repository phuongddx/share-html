"use client";

import { useEffect, useState, useRef, createElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { getHighlighter } from "@/lib/shiki-highlighter";
import type { HeadingInfo } from "@/lib/use-scroll-sync";
import "@/app/markdown-viewer.css";

interface MarkdownViewerProps {
  content: string;
  headings?: HeadingInfo[];
}

type ViewMode = "preview" | "raw";

function useTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  useEffect(() => {
    const update = () => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function CodeBlock({ inline, className, children }: CodeBlockProps) {
  const theme = useTheme();
  const [html, setHtml] = useState<string | null>(null);
  const lang = /language-(\w+)/.exec(className ?? "")?.[1] ?? "text";
  const code = String(children ?? "").replace(/\n$/, "");

  useEffect(() => {
    if (inline) return;
    let cancelled = false;
    getHighlighter().then((hl) => {
      if (cancelled) return;
      try {
        const result = hl.codeToHtml(code, {
          lang,
          theme: theme === "dark" ? "github-dark" : "github-light",
        });
        setHtml(result);
      } catch {
        const result = hl.codeToHtml(code, {
          lang: "text",
          theme: theme === "dark" ? "github-dark" : "github-light",
        });
        setHtml(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang, theme, inline]);

  if (inline) {
    return <code className={className}>{children}</code>;
  }

  if (html) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="not-prose"
      />
    );
  }

  return (
    <pre className="shiki">
      <code>{code}</code>
    </pre>
  );
}

// Custom heading components that inject data-heading-line for scroll sync
function createHeadingComponents(headings?: HeadingInfo[]): Components {
  if (!headings || headings.length === 0) return {};

  const headingCounter = { current: -1 };

  return {
    h1: ({ children, ...props }) => {
      headingCounter.current++;
      const heading = headings[headingCounter.current];
      return createElement(
        "h1",
        {
          ...props,
          "data-heading-line": heading?.line,
        },
        children
      );
    },
    h2: ({ children, ...props }) => {
      headingCounter.current++;
      const heading = headings[headingCounter.current];
      return createElement(
        "h2",
        {
          ...props,
          "data-heading-line": heading?.line,
        },
        children
      );
    },
    h3: ({ children, ...props }) => {
      headingCounter.current++;
      const heading = headings[headingCounter.current];
      return createElement(
        "h3",
        {
          ...props,
          "data-heading-line": heading?.line,
        },
        children
      );
    },
    h4: ({ children, ...props }) => {
      headingCounter.current++;
      const heading = headings[headingCounter.current];
      return createElement(
        "h4",
        {
          ...props,
          "data-heading-line": heading?.line,
        },
        children
      );
    },
    h5: ({ children, ...props }) => {
      headingCounter.current++;
      const heading = headings[headingCounter.current];
      return createElement(
        "h5",
        {
          ...props,
          "data-heading-line": heading?.line,
        },
        children
      );
    },
    h6: ({ children, ...props }) => {
      headingCounter.current++;
      const heading = headings[headingCounter.current];
      return createElement(
        "h6",
        {
          ...props,
          "data-heading-line": heading?.line,
        },
        children
      );
    },
  };
}

export function MarkdownViewer({ content, headings }: MarkdownViewerProps) {
  const [mode, setMode] = useState<ViewMode>("preview");
  const headingComponents = createHeadingComponents(headings);

  const mdComponents: Components = {
    code: CodeBlock as Components["code"],
    ...headingComponents,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-md border border-border bg-secondary p-1 text-muted-foreground text-xs gap-1">
          <button
            onClick={() => setMode("preview")}
            className={`rounded px-3 py-1 font-medium transition-colors duration-200 ${
              mode === "preview"
                ? "bg-background text-foreground"
                : "hover:text-foreground"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setMode("raw")}
            className={`rounded px-3 py-1 font-medium transition-colors duration-200 ${
              mode === "raw"
                ? "bg-background text-foreground"
                : "hover:text-foreground"
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="markdown-body px-2 py-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <pre className="markdown-raw">{content}</pre>
      )}
    </div>
  );
}
