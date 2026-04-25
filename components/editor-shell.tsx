"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import type { EditorView } from "@codemirror/view";
import dynamic from "next/dynamic";
import { EditorToolbar } from "@/components/editor-toolbar";
import { EditorPreview } from "@/components/editor-preview";
import { EditorPublishBar } from "@/components/editor-publish-bar";
import { useEditorAutoSave } from "@/lib/use-editor-auto-save";
import type { EditorPaneRef } from "@/components/editor-pane";
import {
  useScrollSync,
  parseHeadings,
  type HeadingInfo,
} from "@/lib/use-scroll-sync";
import { nanoid } from "nanoid";
import { toast } from "sonner";

const EditorPane = dynamic(
  () =>
    import("@/components/editor-pane").then((mod) => mod.EditorPane),
  { ssr: false }
);

type TabMode = "write" | "preview";

export function EditorShell() {
  const searchParams = useSearchParams();
  const editSlug = searchParams.get("slug");

  const [content, setContent] = useState("");
  const [tab, setTab] = useState<TabMode>("write");
  const [mounted, setMounted] = useState(false);
  const [editTitle, setEditTitle] = useState<string | undefined>();
  const editorPaneRef = useRef<EditorPaneRef>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const initialDraftRef = useRef<string | null>(null);
  const isDirty = content.length > 0 && content !== (initialDraftRef.current ?? "");

  const { hasDraft, restoreDraft, clearDraft } = useEditorAutoSave(content);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (initialDraftRef.current !== null) return;

    if (editSlug) {
      fetch(`/api/shares/${editSlug}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => {
          setContent(data.content || "");
          setEditTitle(data.title || data.filename);
          initialDraftRef.current = data.content || "";
        })
        .catch(() => {
          initialDraftRef.current = "";
        });
      return;
    }

    if (hasDraft) {
      const draft = restoreDraft();
      if (draft && draft.length > 0) {
        initialDraftRef.current = draft;
        setContent(draft);
      }
    } else {
      initialDraftRef.current = "";
    }
  }, [mounted, hasDraft, restoreDraft, editSlug]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const editorViewRef = {
    get current() {
      return editorPaneRef.current?.editorView ?? null;
    },
  } as RefObject<EditorView | null>;

  const toggleTheme = useCallback(() => {
    document.documentElement.classList.toggle("dark");
  }, []);

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    if (!mounted) return;
    const update = () => {
      setEffectiveTheme(
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
  }, [mounted]);

  // Heading parsing + scroll sync
  const headings = useMemo(() => parseHeadings(content), [content]);
  const scrollSyncEnabled = tab !== "preview";

  useScrollSync({
    editorViewRef,
    previewContainerRef,
    headings,
    enabled: scrollSyncEnabled,
  });

  // Image upload handler
  const handleImageFile = useCallback(async (file: File, view: EditorView) => {
    const id = nanoid(8);
    const { from } = view.state.selection.main;
    const placeholder = `![Uploading...](uploading-${id})`;
    const placeholderLen = placeholder.length;

    view.dispatch({ changes: { from, insert: placeholder } });
    const insertPos = from;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const { url, filename } = await res.json();

      // Verify placeholder still exists at expected position
      const textAtPos = view.state.doc.sliceString(insertPos, insertPos + placeholderLen);
      if (textAtPos === placeholder) {
        view.dispatch({
          changes: {
            from: insertPos,
            to: insertPos + placeholderLen,
            insert: `![${filename}](${url})`,
          },
        });
      }
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      const textAtPos = view.state.doc.sliceString(insertPos, insertPos + placeholderLen);
      if (textAtPos === placeholder) {
        view.dispatch({
          changes: { from: insertPos, to: insertPos + placeholderLen, insert: "" },
        });
      }
    }
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <EditorToolbar
        editorRef={editorViewRef}
        theme={effectiveTheme}
        onToggleTheme={toggleTheme}
      />

      {/* Mobile tab bar */}
      <div className="flex border-b md:hidden">
        <button
          onClick={() => setTab("write")}
          className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
            tab === "write"
              ? "border-b-2 border-violet-600 text-foreground"
              : "text-muted-foreground"
          }`}
        >
          Write
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
            tab === "preview"
              ? "border-b-2 border-violet-600 text-foreground"
              : "text-muted-foreground"
          }`}
        >
          Preview
        </button>
      </div>

      {/* Editor + Preview layout */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex-1 overflow-hidden ${
            tab !== "write" ? "hidden md:block" : ""
          }`}
        >
          <EditorPane
            ref={editorPaneRef}
            content={content}
            onChange={setContent}
            theme={effectiveTheme}
            onImageFile={handleImageFile}
          />
        </div>

        <div
          className={`flex-1 overflow-hidden border-l ${
            tab !== "preview" ? "hidden md:block" : ""
          }`}
        >
          <EditorPreview
            ref={previewContainerRef}
            content={content}
            headings={headings}
          />
        </div>
      </div>

      <EditorPublishBar
        content={content}
        isDirty={isDirty}
        mode={editSlug ? "edit" : "create"}
        editSlug={editSlug || undefined}
        editTitle={editTitle}
        onClearDraft={clearDraft}
      />
    </div>
  );
}
