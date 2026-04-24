import { type Extension, Compartment } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab, history, historyKeymap } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language";
import { defaultKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { imagePreviewExtension } from "./editor-extensions/image-preview";
import { slashCommandExtension } from "./editor-extensions/slash-commands";
import { imageDropExtension } from "./editor-extensions/image-drop";

export const themeCompartment = new Compartment();

const lightTheme = EditorView.theme({
  "&": { backgroundColor: "#ffffff" },
  ".cm-content": { color: "#1f2937" },
  ".cm-gutters": {
    backgroundColor: "#f9fafb",
    color: "#6b7280",
    border: "none",
  },
});

function bold(view: EditorView): boolean {
  return wrapSelection(view, "**", "**");
}

function italic(view: EditorView): boolean {
  return wrapSelection(view, "*", "*");
}

function link(view: EditorView): boolean {
  return wrapSelection(view, "[", "](url)");
}

function wrapSelection(
  view: EditorView,
  before: string,
  after: string
): boolean {
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
  return true;
}

export function createEditorExtensions(
  theme: "light" | "dark",
  onImageFile?: (file: File, view: EditorView) => void
): Extension[] {
  return [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    history(),
    foldGutter(),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
    keymap.of([
      { key: "Mod-b", run: bold },
      { key: "Mod-i", run: italic },
      { key: "Mod-k", run: link },
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    placeholder("Start writing your markdown..."),
    themeCompartment.of(theme === "dark" ? [oneDark] : [lightTheme]),
    slashCommandExtension(),
    imagePreviewExtension(),
    onImageFile ? imageDropExtension({ onImageFile }) : [],
  ];
}

export function updateTheme(view: EditorView, theme: "light" | "dark") {
  view.dispatch({
    effects: themeCompartment.reconfigure(
      theme === "dark" ? [oneDark] : [lightTheme]
    ),
  });
}
