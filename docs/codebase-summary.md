# Codebase Summary

## Overview
Share HTML is a Next.js 16 application that allows users to upload HTML files and receive short, shareable links. The platform enables HTML content sharing with text search capabilities, deployed on Vercel with Supabase as the backend.

## Technology Stack
- **Framework**: Next.js 16.2.4 (App Router, React 19)
- **Database**: Supabase (PostgreSQL, Storage, SSR v3 cookie-based sessions)
- **Styling**: Tailwind CSS 4 + shadcn/ui + Base UI React
- **Rate Limiting**: Upstash Redis
- **Language**: TypeScript 5
- **Additional**: nanoid, react-dropzone, next-themes, sonner

## File Structure Overview

```
app/
├── layout.tsx, page.tsx, not-found.tsx, error.tsx, loading.tsx, globals.css
├── s/[slug]/page.tsx, loading.tsx
├── search/page.tsx, loading.tsx
└── api/
    ├── upload/route.ts
    ├── shares/[slug]/route.ts
    └── search/route.ts

components/
├── ui/{button,card,input,sonner}.tsx
├── search-bar.tsx, search-results.tsx
├── upload-dropzone.tsx, share-link.tsx
├── home-page.tsx, theme-provider.tsx, html-viewer.tsx

lib/
├── utils.ts, nanoid.ts, extract-text.ts, rate-limit.ts

utils/supabase/
├── client.ts, server.ts, middleware.ts

types/
└── share.ts

supabase/
├── schema.sql, config.toml

public/
└── {file,vercel,next,globe,window}.svg
```

## Core Application Pages

### Home Page (`/`)
- Server component wrapping client `HomePage`
- Features upload dropzone interface
- Direct link to share creation

### Share View (`/s/[slug]`)
- Displays shared HTML in sandboxed iframe
- Includes metadata display
- Handles 404 states for invalid slugs

### Search Page (`/search?q=`)
- Full-text search across uploaded HTML content
- Results display with pagination
- Search interface integration

## API Routes

### Upload API (`POST /api/upload`)
- Accepts HTML file uploads
- Stores files in Supabase Storage
- Creates database records with unique slugs
- Extracts text content for search indexing
- Implements rate limiting and validation

### Delete API (`DELETE /api/shares/[slug]`)
- Deletes shared HTML (requires delete token)
- Handles cleanup of storage and database
- Security through token-based auth

### Search API (`GET /api/search?q=&limit=&offset=`)
- Full-text search via Supabase RPC
- Supports pagination with limit/offset
- Returns paginated search results

## Component Architecture

### UI Components (4)
- **button.tsx**: Reusable button with variants
- **card.tsx**: Styled card container
- **input.tsx**: Form input field with variants
- **sonner.tsx**: Toast notifications

### Application Components (7)
- **search-bar.tsx**: Search input interface
- **search-results.tsx**: Paginated results display
- **upload-dropzone.tsx**: Drag-and-drop file upload
- **share-link.tsx**: Share link generation and display
- **home-page.tsx**: Main landing page
- **theme-provider.tsx**: Theme switching (light/dark)
- **html-viewer.tsx**: Iframe-based HTML rendering with CSP

## Library Functions

### Core Utilities
- **utils.ts**: cn() class name helper utility
- **nanoid.ts**: URL-safe slug and token generation
- **extract-text.ts**: HTML text extraction for search indexing
- **rate-limit.ts**: Upstash Redis-based rate limiting

## Supabase Integration

### Client Configuration
- **client.ts**: Browser-compatible Supabase client (anon)
- **server.ts**: Server-side clients (anon + service_role)
- **middleware.ts**: SSR session refresh and auth handling

### Database Schema
- **shares table**:
  - id, slug, filename, storage_path
  - content_text, search_vec (TSVECTOR)
  - file_size, mime_type, delete_token
  - created_at, expires_at (30 days), view_count

### Security & RLS
- Row Level Security enabled
- Public read access
- Server writes via service_role
- Storage bucket: "html-files" (public, 10MB max)

## Key Architectural Patterns

### Dual Client Strategy
- **Anon client**: Browser operations, respects RLS for reads
- **Admin client**: Server operations, service_role for writes/storage

### File Upload Process
- Compensating transaction for consistency
- Storage path: `/html-files/{id}/{slug}`
- Database record creation after successful storage
- Text extraction and vector search setup

### HTML Viewing Security
- Iframe sandboxing with CSP headers
- Content Security Policy for safe rendering
- Metadata display without execution context

### Rate Limiting
- 10 requests per minute via Upstash Redis
- Graceful degradation on limit exceeded
- Configurable thresholds per route

### URL Structure
- Slug-based URLs using nanoid (10 characters)
- Format: `/s/{slug}`
- Delete tokens: separate security mechanism
- 30-day expiration policy

## Data Flow

1. **Upload Flow**: User → Upload API → Supabase Storage → Database → Search Index
2. **View Flow**: User → Share URL → Iframe + Metadata → View Counter Update
3. **Search Flow**: Query → Search API → Supabase RPC → Results Display
4. **Delete Flow**: Token Verification → Storage Cleanup → Database Deletion

## Performance Considerations

- Static generation where possible
- Client-side loading states
- Efficient pagination for search results
- Minimal re-renders with proper React patterns
- CDN integration for uploaded HTML files

## Security Features

- Input validation on all endpoints
- File type restrictions (HTML only)
- Row Level Security (RLS) on database
- Service role isolation for privileged operations
- Content Security Policy for iframe rendering
- Token-based deletion authorization