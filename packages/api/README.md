# DropItX API Server

Hono-based API server for DropItX, handling all backend operations including document management, authentication, team workspaces, and analytics.

## Tech Stack

- **Framework**: Hono
- **Runtime**: Node.js (Edge-compatible for Vercel deployment)
- **Validation**: Zod
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **Auth**: Supabase JWT + API keys

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run type checking
pnpm type-check
```

## API Routes

### Public REST API (`/v1/`)

#### API Keys
- `GET /v1/keys` - List user's API keys
- `POST /v1/keys` - Create new API key
- `DELETE /v1/keys/:id` - Revoke API key

#### Documents
- `GET /v1/documents` - List user's documents
- `POST /v1/documents` - Create new document
- `GET /v1/documents/:slug` - Get document by slug
- `PATCH /v1/documents/:slug` - Update document
- `DELETE /v1/documents/:slug` - Delete document

### Dashboard API (`/dashboard/`)

#### File Operations
- `POST /dashboard/upload` - Upload file (multipart, ≤50 MB)
- `POST /dashboard/publish` - Publish from editor
- `POST /dashboard/images/upload` - Upload inline image (≤5 MB)

#### Share Management
- `GET /dashboard/shares` - List user's shares
- `GET /dashboard/shares/:slug` - Get share details
- `PATCH /dashboard/shares/:slug` - Update share
- `DELETE /dashboard/shares/:slug` - Delete share
- `POST /dashboard/shares/:slug/set-password` - Set share password
- `POST /dashboard/shares/:slug/unlock` - Unlock password-protected share

#### Search & Analytics
- `GET /dashboard/search` - Full-text search
- `POST /dashboard/analytics/track` - Track analytics event

#### Teams
- `GET /dashboard/teams` - List user's teams
- `POST /dashboard/teams` - Create new team
- `GET /dashboard/teams/:slug` - Get team details
- `PATCH /dashboard/teams/:slug` - Update team
- `DELETE /dashboard/teams/:slug` - Delete team
- `GET /dashboard/teams/:slug/members` - List team members
- `POST /dashboard/teams/:slug/members` - Add team member
- `DELETE /dashboard/teams/:slug/members/:userId` - Remove team member
- `GET /dashboard/teams/:slug/invites` - List team invitations
- `POST /dashboard/teams/:slug/invites` - Create invitation
- `POST /dashboard/teams/:slug/invites/bulk` - Bulk invite members
- `POST /dashboard/teams/:slug/invites/:inviteId/resend` - Resend invitation
- `GET /dashboard/teams/:slug/events` - Get team activity feed
- `GET /dashboard/teams/:slug/shares` - List team shares

#### Metadata
- `GET /oembed` - oEmbed endpoint for embeds

## Authentication

### Cookie-based Auth (Browser)
- Used by web dashboard
- Supabase JWT tokens stored in HTTP-only cookies
- Middleware validates session on protected routes

### API Key Auth (Programmatic)
- Used by CLI, mobile apps, external integrations
- `Authorization: Bearer shk_...` header
- SHA-256 hash stored in database
- Supports personal (`shk_`) and team (`sht_`) keys

## Middleware

### `requireAuth`
Validates Supabase JWT token from cookies or Authorization header.

### `requireTeamMember`
Checks if user is a member of the specified team workspace.

### `requireApiKey`
Validates API key from Authorization header.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret for token validation |
| `CORS_ORIGIN` | Yes | Allowed CORS origin (e.g., `https://dropitx.vercel.app`) |

## Deployment

This package is deployed as a separate Vercel project with the following settings:

- **Root Directory**: `packages/api`
- **Framework Preset**: Other
- **Build Command**: `cd ../.. && pnpm turbo build --filter=@dropitx/api`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install`

## Rate Limiting

Implemented via Supabase Postgres RPC functions:
- 10 requests/minute per IP for upload/API endpoints
- 5 attempts/10 minutes per IP for password unlock
- Configurable via database functions

## Error Handling

All endpoints return consistent error responses:
```json
{
  "error": "Error message description"
}
```

HTTP status codes:
- `400` - Bad request (validation errors)
- `401` - Unauthorized (invalid/missing credentials)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `429` - Too many requests (rate limit exceeded)
- `500` - Internal server error

## Security

- All mutations use service role key (bypasses RLS)
- All reads respect RLS policies
- API keys are stored as SHA-256 hashes
- JWT tokens validated on every request
- CORS restricted to specific origin
- Rate limiting on all public endpoints
- Input validation via Zod schemas

## Testing

```bash
# Run tests (when implemented)
pnpm test

# Run integration tests
pnpm test:integration
```

## License

Part of the DropItX project. See root LICENSE file.
