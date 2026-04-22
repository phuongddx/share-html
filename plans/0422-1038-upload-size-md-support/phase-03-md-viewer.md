# Phase 3: Build Markdown Viewer — Frontend

## Context Links

- Existing HTML viewer: `components/html-viewer.tsx`
- Share page: `app/s/[slug]/page.tsx`
- Globals CSS: `app/globals.css`

## Overview

- Priority: High
- Status: Completed
- Build the MarkdownViewer component with preview/raw toggle, syntax highlighting, and GitHub-like prose styling.

## Key Insights

- Use `react-markdown` + `remark-gfm` for parsing/rendering
- Use `shiki` with `createHighlighterCore` + JS engine for client-side syntax highlighting
- Fine-grained language bundles keep bundle manageable (~10 languages)
- Lazy-load the entire MarkdownViewer since it's only needed for `.md` files
- GitHub-like prose styling via custom CSS classes — no extra plugin needed

## Requirements

- Rendered preview: full GFM (tables, task lists, strikethrough)
- Raw mode: display raw markdown in a `<pre>` block
- Toggle button to switch between modes
- Code blocks get syntax highlighting via shiki
- GitHub-like typography for prose content
- Responsive, works in both light and dark mode
- Lazy loaded (only imported when viewing `.md` files)

## Related Code Files

| Action | File | Change |
|--------|------|--------|
| Create | `lib/shiki-highlighter.ts` | Shiki singleton with curated languages |
| Create | `components/markdown-viewer.tsx` | Markdown viewer with toggle |
| Create | `app/markdown-viewer.css` | GitHub-like prose styles |
| Modify | `package.json` | Add deps: react-markdown, remark-gfm, shiki, @shikijs/* |

## Implementation Steps

1. Install dependencies:
   ```bash
   npm install react-markdown remark-gfm shiki
   npm install -D @types/react-markdown
   ```
   No need for separate `@shikijs/langs-*` packages — use `shiki/langs` bundled imports.

2. Create `lib/shiki-highlighter.ts` — singleton shiki highlighter:
   ```typescript
   import { createHighlighterCore, type HighlighterCore } from "shiki/core";
   import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

   let highlighterPromise: Promise<HighlighterCore> | null = null;

   const LANGUAGES = [
     "javascript", "typescript", "python", "html", "css",
     "json", "bash", "markdown", "sql", "go",
   ];

   export function getHighlighter(): Promise<HighlighterCore> {
     if (!highlighterPromise) {
       highlighterPromise = createHighlighterCore({
         langs: LANGUAGES.map((lang) =>
           import(`shiki/langs/${lang}`)
         ),
         themes: [
           import("shiki/themes/github-light"),
           import("shiki/themes/github-dark"),
         ],
         engine: createJavaScriptRegexEngine(),
       });
     }
     return highlighterPromise;
   }
   ```
   Note: Use dynamic `import()` for shiki/langs — verify this works or use named imports if not.

3. Create `components/markdown-viewer.tsx`:
   - Props: `{ content: string }`
   - State: `mode: "preview" | "raw"`
   - Toggle button in the header (Eye icon for preview, Code icon for raw)
   - Preview mode: `<ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }} />`
   - Raw mode: `<pre>` with the raw markdown content, styled with monospace font
   - `CodeBlock` component: extracts language from className, calls shiki `codeToHtml`, renders via `dangerouslySetInnerHTML`
   - Lazy loaded via `next/dynamic` from the share page

4. Create `app/markdown-viewer.css` — GitHub-like prose styles:
   - `.markdown-body` class as root container
   - Style: headings (h1-h6), paragraphs, lists, blockquotes, tables, code blocks, links, images, hr
   - Use `var(--foreground)`, `var(--muted-foreground)` etc. for dark mode compatibility
   - Table styling: bordered, striped rows
   - Code block: rounded, padding, scrollable overflow
   - Inline code: subtle background, monospace font

5. Import CSS in `components/markdown-viewer.tsx` or in `globals.css`

## Architecture

```
MarkdownViewer (lazy loaded)
├── Toggle Button (preview/raw)
├── Preview Mode
│   └── ReactMarkdown + remarkGfm
│       └── CodeBlock component
│           └── shiki highlighter (singleton)
└── Raw Mode
    └── <pre> with raw content
```

## Success Criteria

- [ ] Markdown renders correctly with GFM features (tables, task lists, strikethrough)
- [ ] Code blocks highlighted with correct syntax colors
- [ ] Toggle switches between preview and raw seamlessly
- [ ] Styles look good in both light and dark mode
- [ ] Component is lazy loaded (verify in network tab)
- [ ] No layout shift when toggling modes

## Risk Assessment

- **Shiki bundle size**: Fine-grained imports with 10 languages should be ~200-400KB. Monitor and reduce if needed.
- **Dynamic import path**: `import(`shiki/langs/${lang}`)` may not work with all bundlers. Fallback: explicit named imports.
- **Dark mode theme detection**: Use `document.documentElement.classList.contains('dark')` or the app's theme provider.

## Security Considerations

- `react-markdown` sanitizes HTML by default — safe
- shiki output is static HTML — no XSS risk
- `dangerouslySetInnerHTML` only used for shiki output (trusted source)
