# Design Guidelines

## Overview

DropItX uses Tailwind CSS 4 + shadcn/ui for styling. Design tokens defined in `app/globals.css` via CSS custom properties with OKLCH color space. v1.0.0 introduced a full blue accent design overhaul.

## Design Principles

- **Simplicity**: Minimal UI — upload, share, search, write
- **Accessibility**: WCAG 2.1 AA contrast, keyboard nav, semantic HTML
- **Theme**: Light/dark via `next-themes` + `ThemeProvider`

## Color System

All theme variables in `app/globals.css` using `oklch()`. The v1.0.0 overhaul established blue as the primary accent color.

| Token | Purpose |
|-------|---------|
| `--background`, `--foreground` | Page background/text |
| `--card`, `--card-foreground` | Card surfaces |
| `--primary`, `--primary-foreground` | CTAs, links (blue accent) |
| `--secondary`, `--secondary-foreground` | Secondary actions |
| `--muted`, `--muted-foreground` | Subtle/disabled text |
| `--accent`, `--accent-foreground` | Highlights |
| `--destructive`, `--destructive-foreground` | Error/danger |
| `--border`, `--input`, `--ring` | Borders, focus rings |
| `--radius` | Border radius |

`.dark` class overrides all tokens for dark mode.

## Typography

- **Font**: Ubuntu (`--font-sans`), Ubuntu Mono (`--font-mono`)
- Loaded via `next/font/google` in `app/layout.tsx`
- Weights: 300 (light), 400 (regular), 500 (medium), 700 (bold) for Sans; 400, 700 for Mono
- Responsive text sizes via Tailwind classes (`text-sm`, `text-lg`, etc.)

## Component Library

### UI Components (`components/ui/`)
- **Button**: Variants via `class-variance-authority` (default, outline, secondary, ghost, destructive, link) + sizes (default, xs, sm, lg, icon)
- **Card**: Container with Header, Content, Footer, Title, Description, Action subcomponents
- **Input**: Base UI Input primitive with consistent styling
- **Textarea**: Multi-line input component with consistent styling
- **Dialog**: Modal dialog component for user interactions
- **Select**: Dropdown select component for single/multiple selections
- **Badge**: Status and indicator component with various styles
- **Alert**: Contextual alert component with different severity levels
- **Toaster**: Sonner toast with theme-aware Lucide icons
- **Skeleton**: Loading state component matching final layout

### Upload / Share Components
- **UploadDropzone**: react-dropzone; state machine (idle/dragging/uploading/success/error); full-width mobile, max-w-2xl centered desktop
- **ShareLink**: Share URL display + copy-to-clipboard + delete link
- **HtmlViewer**: Sandboxed iframe + CSP meta tag injection for secure HTML rendering
- **MarkdownViewer**: react-markdown + remark-gfm + shiki; preview/raw toggle; GitHub-like prose styles
- **MarkdownViewerWrapper**: `next/dynamic` wrapper (client-side only)

### Editor Components
- **EditorShell**: Top-level editor layout; split-pane at `lg:` breakpoint
- **EditorPane**: CodeMirror 6; monospace font; theme follows system dark/light via Compartment
- **EditorPreview**: Live Markdown rendering; matches MarkdownViewer prose styles
- **EditorToolbar**: Format action buttons; keyboard shortcut labels
- **EditorPublishBar**: Title input, custom slug input, privacy toggle, publish button; sticky at bottom

### Dashboard / Auth Components
- **DashboardShareCard**: Share card with title, slug, stats (views), edit/delete actions, password lock toggle
- **ApiKeyManager**: Table of API keys (prefix, created_at, last_used_at); create/revoke actions
- **BookmarkToggle**: Icon button; filled/outline state; optimistic update
- **ProfileForm**: Display name + avatar URL inputs with save feedback
- **AuthUserMenu**: Header dropdown; avatar or initials fallback; profile + logout links
- **AnalyticsStatsCards**: Performance metrics cards for dashboard analytics view
- **AnalyticsCharts**: Recharts-based visualization components for user engagement data

### Header Components
- **HeaderBar**: Main header orchestrator; manages mobile/desktop state and mobile drawer
- **HeaderNav**: Desktop navigation links; responsive menu toggle for mobile
- **HeaderMobileDrawer**: Slide-out mobile navigation with backdrop and close functionality

### Search / Navigation
- **SearchBar**: Debounced (300 ms) input → URL params navigation
- **SearchResults**: Result cards with relative time, skeleton loading, empty state
- **ThemeProvider**: next-themes class-based dark/light toggle

### Team Components
- **CreateTeamForm**: Workspace creation interface with name/description inputs
- **TeamMemberRow**: Member display with role indicator and remove action
- **TeamNav**: Workspace navigation sidebar with member list
- **TeamShareCard**: Share card within workspace context with workspace actions
- **InviteMemberDialog**: Email-based invitation system for workspace members
- **TeamInviteForm**: Enhanced invite form with role selection and email validation
- **EnhancedInviteDialog**: Invite dialog with team RPC client and link generation
- **BulkInviteDialog**: Bulk invitation system supporting multiple email addresses
- **InviteAcceptForm**: Accept invitation and join team flow
- **InviteStatusCard**: Invite status tracking and management
- **CopyButton**: Copy-to-clipboard component for share links

## Spacing

Tailwind default spacing scale. Consistent `p-4`/`p-6` padding for cards. `gap-6`/`gap-8` for layouts.

## Responsive Design

Tailwind breakpoints (mobile-first):

| Breakpoint | Width | Usage |
|------------|-------|-------|
| default | < 640px | Stacked single-column |
| `sm:` | 640px | |
| `md:` | 768px | Two-column grids |
| `lg:` | 1024px | Editor split-pane, share page sidebar |

- Upload area: full-width on mobile, `max-w-2xl` centered on desktop
- Editor: single pane on mobile, split 50/50 on `lg:`
- Share page: stacked on mobile, sidebar layout on `lg:`

## Interaction Patterns

| Pattern | Implementation |
|---------|---------------|
| File upload | Drag-and-drop + click fallback; visual state feedback |
| Copy to clipboard | `navigator.clipboard.writeText` with fallback |
| Search | Debounced input → URL params → API call → results |
| Theme toggle | Class-based `.dark` on `<html>` |
| OAuth login | Button click → Supabase OAuth redirect → callback |
| Email authentication | Split-screen login with form validation and PKCE flow |
| Team invite | Single invite with role selection, bulk invite, resend functionality |
| Favorites toggle | `BookmarkToggle`; optimistic update; auth-gated |
| Editor publish | `EditorPublishBar`; validates title; submits to `/api/publish` |
| Slash commands | Type `/` in `EditorPane`; command palette overlay |
| Image drop in editor | Drop image → `POST /api/images/upload` → insert `![alt](url)` |
| Error handling | Sonner toast; error boundary for unhandled errors |
| Loading states | Skeleton components matching final layout |
| Invite flow | Form validation → server validation → success feedback |

## Security in UI

- **HtmlViewer**: Sandboxed iframe (`sandbox="allow-scripts"`) + CSP meta tag injection
- **File validation**: Extension (`.html`/`.htm`/`.md`), size (≤ 50 MB) checks client-side; MIME validation server-side
- **Image validation**: Extension + size (≤ 5 MB) client-side hint; full validation server-side
- **Rate limiting**: 10 requests/minute per IP on write endpoints; 5 attempts/10 min for password unlock
- **Password protection**: bcryptjs hash with HMAC-SHA256 access cookies; multi-layer access gates
- **Team workspace isolation**: RLS policies ensure members only see their own workspace content
