# Design Guidelines

## Overview

Share HTML uses Tailwind CSS 4 + shadcn/ui + Base UI React for styling. Design tokens defined in `app/globals.css` via CSS custom properties with OKLCH color space.

## Design Principles

- **Simplicity**: Minimal UI — upload, share, search
- **Accessibility**: WCAG 2.1 AA contrast, keyboard nav, semantic HTML
- **Theme**: Light/dark via `next-themes` + `ThemeProvider`

## Color System

All theme variables in `app/globals.css` using `oklch()`:

| Token | Purpose |
|-------|---------|
| `--background`, `--foreground` | Page background/text |
| `--card`, `--card-foreground` | Card surfaces |
| `--primary`, `--primary-foreground` | CTAs, links |
| `--secondary`, `--secondary-foreground` | Secondary actions |
| `--muted`, `--muted-foreground` | Subtle/disabled |
| `--accent`, `--accent-foreground` | Accents |
| `--destructive`, `--destructive-foreground` | Error/danger |
| `--border`, `--input`, `--ring` | Borders, focus rings |
| `--radius` | Border radius |

`.dark` class overrides all tokens for dark mode.

## Typography

- **Font**: Geist Sans (variable: `--font-geist-sans`), Geist Mono (variable: `--font-geist-mono`)
- Loaded via `next/font/google` in `app/layout.tsx`
- Responsive text sizes via Tailwind classes (`text-sm`, `text-lg`, etc.)

## Component Library

### UI Components (`components/ui/`)
Built with shadcn/ui + Base UI React primitives:
- **Button**: Variants via `class-variance-authority` (default, outline, secondary, ghost, destructive, link) + sizes (default, xs, sm, lg, icon)
- **Card**: Container with Header, Content, Footer, Title, Description, Action subcomponents + size variants
- **Input**: Base UI Input primitive with consistent styling
- **Toaster**: Sonner toast with theme-aware icons from Lucide

### Application Components (`components/`)
- **HomePage**: Landing page orchestrator
- **UploadDropzone**: react-dropzone with state machine (idle/dragging/uploading/success/error)
- **ShareLink**: Share URL display + copy-to-clipboard + delete link
- **SearchBar**: Debounced search input (300ms) with router navigation
- **SearchResults**: Results cards with relative time, skeleton loading, empty state
- **HtmlViewer**: Sandboxed iframe with CSP injection for secure HTML rendering
- **ThemeProvider**: next-themes wrapper for class-based dark/light toggle

## Spacing

Tailwind default spacing scale. Consistent `p-4`/`p-6` padding for cards. `gap-6`/`gap-8` for layouts.

## Responsive Design

Tailwind breakpoints:
- `sm:` 640px, `md:` 768px, `lg:` 1024px
- Mobile-first — content stacks on small screens, grid layouts on desktop
- Upload area: full-width on mobile, max-w-2xl centered on desktop
- Share page: stacked on mobile, sidebar layout on `lg:`

## Interaction Patterns

- **File upload**: Drag-and-drop + click fallback, visual state feedback
- **Copy to clipboard**: navigator.clipboard.writeText with fallback
- **Search**: Debounced input → URL params → API call → results render
- **Theme toggle**: Class-based `.dark` on `<html>` element
- **Error handling**: Toast notifications via Sonner, error boundary for unhandled errors
- **Loading states**: Skeleton components matching final layout

## Security in UI

- **HtmlViewer**: Sandboxed iframe (`sandbox="allow-scripts"`) + CSP meta tag injection
- **File validation**: Extension (.html/.htm), MIME type, size (10MB) checks
- **Rate limiting**: 10 requests/minute per IP on upload endpoint
