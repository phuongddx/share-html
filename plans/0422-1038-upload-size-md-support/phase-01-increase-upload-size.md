# Phase 1: Increase Upload Size to 50MB

## Context Links

- Upload API: `app/api/upload/route.ts`
- Dropzone component: `components/upload-dropzone.tsx`
- Schema: `supabase/schema.sql`
- README: `README.md`

## Overview

- Priority: High (blocks Phase 2)
- Status: Completed
- Update all upload size limits from 10MB to 50MB across client, server, and storage config.

## Key Insights

- Next.js App Router route handlers have a default body size limit — must explicitly configure
- Supabase Storage bucket limit is set in Dashboard or via migration
- Rate limit (10/min per IP) is independent of file size — no change needed

## Requirements

- Client dropzone rejects files > 50MB
- Server API rejects files > 50MB
- Next.js route handler allows 50MB body
- Supabase bucket configured for 50MB

## Related Code Files

| Action | File | Change |
|--------|------|--------|
| Modify | `components/upload-dropzone.tsx` | Update `MAX_SIZE` constant |
| Modify | `app/api/upload/route.ts` | Update `MAX_FILE_SIZE` + add route segment config |
| Update | Supabase Dashboard | Increase `html-files` bucket file size limit |
| Modify | `README.md` | Update "up to 10MB" → "up to 50MB" |

## Implementation Steps

1. In `components/upload-dropzone.tsx`:
   - Change `MAX_SIZE` from `10 * 1024 * 1024` to `50 * 1024 * 1024`
   - Update error message: "Only .html/.htm files under 50MB are accepted."

2. In `app/api/upload/route.ts`:
   - Change `MAX_FILE_SIZE` from `10 * 1024 * 1024` to `50 * 1024 * 1024`
   - Update error message: "File too large. Maximum size is 50MB."
   - Add route segment config for body size:
     ```typescript
     export const maxDuration = 60;
     ```

3. Update Supabase storage bucket:
   - Go to Supabase Dashboard → Storage → `html-files` bucket settings
   - Change "Max file size" from 10MB to 50MB
   - Or via SQL: `INSERT INTO storage.buckets (id, name, public, file_size_limit) VALUES ('html-files', 'html-files', true, 52428800) ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;`

4. In `README.md`:
   - Change "(up to 10MB)" → "(up to 50MB)"
   - Change "Max file size: 10MB" → "Max file size: 50MB"

## Success Criteria

- [ ] Files up to 50MB upload successfully
- [ ] Files over 50MB rejected with clear error (client + server)
- [ ] No Next.js body parser errors on large uploads
- [ ] README reflects new limit

## Risk Assessment

- **Slow connections**: Large files may timeout. Mitigated by `maxDuration = 60`.
- **Supabase storage costs**: 50MB per file × many users = higher costs. Acceptable for now — monitor usage.

## Security Considerations

- No new attack surface — same validation flow, larger allowed payload
- Consider adding upload progress indicator (future enhancement)
