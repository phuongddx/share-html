import {
  type CompletionContext,
  type CompletionResult,
  type Completion,
  autocompletion,
} from "@codemirror/autocomplete";
import { type Extension } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

interface SlashCommand extends Completion {
  label: string;
  detail: string;
  apply: string;
}

const COMMANDS: SlashCommand[] = [
  { label: "table", detail: "Markdown table", apply: "\n| Col 1 | Col 2 |\n|-------|-------|\n| Cell  | Cell  |\n" },
  { label: "code", detail: "Code block", apply: "```javascript\n\n```" },
  { label: "image", detail: "Image", apply: "![](url)" },
  { label: "link", detail: "Link", apply: "[text](url)" },
  { label: "h1", detail: "Heading 1", apply: "# " },
  { label: "h2", detail: "Heading 2", apply: "## " },
  { label: "h3", detail: "Heading 3", apply: "### " },
  { label: "h4", detail: "Heading 4", apply: "#### " },
  { label: "quote", detail: "Blockquote", apply: "> " },
  { label: "list", detail: "Bullet list", apply: "- " },
  { label: "ol", detail: "Ordered list", apply: "1. " },
  { label: "hr", detail: "Horizontal rule", apply: "\n---\n" },
  { label: "bold", detail: "Bold text", apply: "**text**" },
  { label: "italic", detail: "Italic text", apply: "*text*" },
];

function isInsideCode(pos: number, state: EditorState): boolean {
  const tree = syntaxTree(state);
  const node = tree.resolveInner(pos, 1);
  if (!node) return true;
  let n: typeof node | null = node;
  while (n) {
    if (
      n.name === "CodeBlock" ||
      n.name === "InlineCode" ||
      n.name === "FencedCode"
    ) {
      return true;
    }
    n = n.parent;
  }
  return false;
}

function slashCommandSource(
  context: CompletionContext
): CompletionResult | null {
  if (isInsideCode(context.pos, context.state)) return null;

  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const match = /(^|\s)\/(\w*)$/.exec(textBefore);
  if (!match) return null;

  const query = match[2];
  const from = context.pos - query.length - 1;

  const filtered = query
    ? COMMANDS.filter((c) => c.label.startsWith(query))
    : COMMANDS;
  if (filtered.length === 0) return null;

  return { from, options: filtered, validFor: /^\/\w*$/ };
}

export function slashCommandExtension(): Extension {
  return autocompletion({ override: [slashCommandSource] });
}
