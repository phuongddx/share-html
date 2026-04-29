import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { type Extension, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

function isInsideCode(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  const node = tree.resolveInner(pos, 1);
  if (!node) return false;
  let n: typeof node | null = node;
  while (n) {
    if (n.name === "CodeBlock" || n.name === "InlineCode" || n.name === "FencedCode") {
      return true;
    }
    n = n.parent;
  }
  return false;
}

class ImageWidget extends WidgetType {
  constructor(readonly url: string, readonly alt: string) {
    super();
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-image-preview";

    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.alt;
    img.loading = "lazy";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "200px";
    img.style.objectFit = "contain";
    img.style.borderRadius = "4px";
    img.style.border = "1px solid var(--border, #e5e7eb)";
    img.style.margin = "4px 0";
    img.onerror = () => {
      container.innerHTML =
        '<span style="color:var(--muted-foreground);font-size:12px">[broken image]</span>';
    };

    container.appendChild(img);
    return container;
  }

  eq(other: ImageWidget) {
    return this.url === other.url;
  }
}

const imagePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;

    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      IMAGE_REGEX.lastIndex = 0;
      let match;
      while ((match = IMAGE_REGEX.exec(text)) !== null) {
        const start = from + match.index;
        const end = start + match[0].length;
        const lineNum = view.state.doc.lineAt(start).number;

        if (lineNum === cursorLine) continue;
        if (isInsideCode(view, start)) continue;
        if (match[2].startsWith("uploading-")) continue;
        // Only render http(s) and relative URLs — block data: etc.
        if (match[2].startsWith("data:") || match[2].startsWith("javascript:")) continue;

        builder.add(
          start,
          start,
          Decoration.widget({
            widget: new ImageWidget(match[2], match[1]),
            block: true,
            side: 1,
          })
        );
      }
    }
    return builder.finish();
  }
  },
  { decorations: (v) => v.decorations }
);

export function imagePreviewExtension(): Extension {
  return imagePreviewPlugin;
}
