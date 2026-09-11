-- ============================================================================
-- 00056 — Profile avatars: public storage bucket
--
-- The customers.avatar_url column already existed (00001) but was never used:
-- there was no bucket and no upload path. This creates the `avatars` bucket
-- (public read) for customer profile pictures.
--
-- Writes are NOT public: uploads happen only through the API route
-- POST /api/profile/avatar, which authenticates the user and writes via the
-- service role (bypassing storage RLS), storing under customers/<id>/.
-- ============================================================================

BEGIN;

-- Public bucket: avatars are readable by anyone with the URL (needed for
-- <img> tags / CDN), but only the API route (service role) can write.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for the bucket
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;
CREATE POLICY "Public read access to avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

COMMIT;
