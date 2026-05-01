import { useEffect, useRef, type RefObject } from "react";
import { type EditorView, EditorView as EV } from "@codemirror/view";

export interface HeadingInfo {
  level: number;
  text: string;
  line: number;
}

export function parseHeadings(content: string): HeadingInfo[] {
  const lines = content.split("\n");
  return lines.reduce<HeadingInfo[]>((acc, line, i) => {
    const match = /^(#{1,6})\s+(.+)/.exec(line);
    if (match) {
      acc.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
    return acc;
  }, []);
}

interface ScrollSyncOptions {
  editorViewRef: RefObject<EditorView | null>;
  previewContainerRef: RefObject<HTMLDivElement | null>;
  headings: HeadingInfo[];
  enabled: boolean;
}

export function useScrollSync({
  editorViewRef,
  previewContainerRef,
  headings,
  enabled,
}: ScrollSyncOptions) {
  const sourceRef = useRef<"editor" | "preview" | null>(null);
  const headingsRef = useRef(headings);
  headingsRef.current = headings;

  // Editor → Preview sync
  useEffect(() => {
    const editorView = editorViewRef.current;
    const previewContainer = previewContainerRef.current;
    if (!enabled || !editorView || !previewContainer || headingsRef.current.length === 0)
      return;

    const handler = () => {
      const view = editorViewRef.current;
      const container = previewContainerRef.current;
      if (!view || !container) return;
      if (sourceRef.current === "preview") return;
      sourceRef.current = "editor";
      const visibleRange = view.visibleRanges[0];
      if (!visibleRange) return;
      const visibleLine = view.state.doc.lineAt(visibleRange.from).number;
      const target = [...headingsRef.current].reverse().find((h) => h.line <= visibleLine);
      if (!target) return;
      const el = container.querySelector(`[data-heading-line="${target.line}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      requestAnimationFrame(() => {
        sourceRef.current = null;
      });
    };
    editorView.scrollDOM.addEventListener("scroll", handler, { passive: true });
    return () => editorView.scrollDOM.removeEventListener("scroll", handler);
  }, [enabled, editorViewRef, previewContainerRef]);

  // Preview → Editor sync
  useEffect(() => {
    const editorView = editorViewRef.current;
    const previewContainer = previewContainerRef.current;
    if (!enabled || !editorView || !previewContainer || headingsRef.current.length === 0)
      return;

    const handler = () => {
      const view = editorViewRef.current;
      const container = previewContainerRef.current;
      if (!view || !container) return;
      if (sourceRef.current === "editor") return;
      sourceRef.current = "preview";
      const allHeadings = container.querySelectorAll("[data-heading-line]");
      let target: Element | null = null;
      for (const el of allHeadings) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= container.getBoundingClientRect().top - 20) {
          target = el;
          break;
        }
      }
      if (!target) return;
      const line = parseInt(target.getAttribute("data-heading-line") ?? "0", 10);
      if (line <= 0) return;
      const pos = view.state.doc.line(line).from;
      view.dispatch({
        effects: EV.scrollIntoView(pos, { y: "center" }),
      });
      requestAnimationFrame(() => {
        sourceRef.current = null;
      });
    };
    previewContainer.addEventListener("scroll", handler, { passive: true });
    return () => previewContainer.removeEventListener("scroll", handler);
  }, [enabled, editorViewRef, previewContainerRef]);
}
