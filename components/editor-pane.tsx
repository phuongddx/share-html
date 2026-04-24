"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  createEditorExtensions,
  updateTheme,
} from "@/lib/editor-extensions";

interface EditorPaneProps {
  content: string;
  onChange: (value: string) => void;
  theme: "light" | "dark";
  onImageFile?: (file: File, view: EditorView) => void;
}

export interface EditorPaneRef {
  editorView: EditorView | null;
}

const EditorPane = forwardRef<EditorPaneRef, EditorPaneProps>(
  function EditorPane({ content, onChange, theme, onImageFile }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onImageFileRef = useRef(onImageFile);
    const isLocalChange = useRef(false);

    onChangeRef.current = onChange;
    onImageFileRef.current = onImageFile;

    useImperativeHandle(ref, () => ({
      get editorView() {
        return viewRef.current;
      },
    }));

    // Create editor on mount
    useEffect(() => {
      if (!containerRef.current) return;

      const state = EditorState.create({
        doc: content,
        extensions: [
          ...createEditorExtensions(theme, onImageFile),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              isLocalChange.current = true;
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync external content changes into the editor
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      if (isLocalChange.current) {
        isLocalChange.current = false;
        return;
      }
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== content) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: content },
        });
      }
    }, [content]);

    // Swap theme via Compartment — no destroy/recreate
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      updateTheme(view, theme);
    }, [theme]);

    return (
      <div
        ref={containerRef}
        className="h-full overflow-auto [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
      />
    );
  }
);

export { EditorPane };
