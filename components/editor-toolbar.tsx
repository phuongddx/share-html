"use client";

import { type RefObject } from "react";
import { EditorView } from "@codemirror/view";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Heading,
  Link,
  Code,
  List,
  ListOrdered,
  Minus,
  Sun,
  Moon,
} from "lucide-react";

interface EditorToolbarProps {
  editorRef: RefObject<EditorView | null>;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

/** Insert text at cursor position, wrapping selection if any */
function insertAtCursor(
  view: EditorView,
  before: string,
  after: string
): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const replacement = before + selected + after;
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: {
      anchor: from + before.length,
      head: from + before.length + selected.length,
    },
  });
  view.focus();
}

/** Insert text at the start of the line containing the cursor */
function insertLinePrefix(view: EditorView, prefix: string): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const lineText = view.state.sliceDoc(line.from, line.to);
  const replacement = prefix + lineText;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: replacement },
    selection: { anchor: line.from + prefix.length },
  });
  view.focus();
}

export function EditorToolbar({
  editorRef,
  theme,
  onToggleTheme,
}: EditorToolbarProps) {
  const view = editorRef.current;

  const handleAction = (action: () => void) => {
    if (!view) return;
    action();
  };

  return (
    <div className="flex items-center gap-0.5 border-b border-border bg-background px-2 py-1">
      <Button
        variant="ghost"
        size="icon-sm"
        title="Bold (Ctrl+B)"
        onClick={() => handleAction(() => insertAtCursor(view!, "**", "**"))}
      >
        <Bold className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Italic (Ctrl+I)"
        onClick={() => handleAction(() => insertAtCursor(view!, "*", "*"))}
      >
        <Italic className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Heading"
        onClick={() =>
          handleAction(() => insertLinePrefix(view!, "## "))
        }
      >
        <Heading className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Link (Ctrl+K)"
        onClick={() =>
          handleAction(() => insertAtCursor(view!, "[", "](url)"))
        }
      >
        <Link className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Code block"
        onClick={() =>
          handleAction(() => insertAtCursor(view!, "\n```\n", "\n```\n"))
        }
      >
        <Code className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Bullet list"
        onClick={() =>
          handleAction(() => insertLinePrefix(view!, "- "))
        }
      >
        <List className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Ordered list"
        onClick={() =>
          handleAction(() => insertLinePrefix(view!, "1. "))
        }
      >
        <ListOrdered className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Horizontal rule"
        onClick={() =>
          handleAction(() => insertAtCursor(view!, "\n---\n", ""))
        }
      >
        <Minus className="size-4" />
      </Button>

      <div className="ml-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Toggle theme"
          onClick={onToggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
