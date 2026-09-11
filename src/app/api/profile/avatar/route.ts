import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// ============================================================================
// POST /api/profile/avatar — upload a profile picture
// DELETE /api/profile/avatar — remove it
//
// Multipart form: file (jpeg/png/webp, <= 2MB raw; the client downsizes before
// uploading). Stored in the public `avatars` bucket under customers/<id>/.
// Updates customers.avatar_url and returns the public URL.
// ============================================================================

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // matches the bucket limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/profile/avatar', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG or WebP images are allowed' },
        { status: 415 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image must be 2MB or smaller' }, { status: 413 });
    }

    const serviceClient = createServiceClient();

    const { data: customer } = await serviceClient
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Stable per-customer path: replacing the avatar overwrites the old object.
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const storagePath = `customers/${customer.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await serviceClient.storage
      .from('avatars')
      .upload(storagePath, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error('[profile-avatar] Upload failed:', uploadError.message);
      return NextResponse.json({ error: 'Could not save your picture. Please try again.' }, { status: 500 });
    }

    const { data: urlData } = serviceClient.storage.from('avatars').getPublicUrl(storagePath);
    const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`; // cache-bust the CDN

    // Remove any previous avatar objects (keep storage tidy)
    const { data: oldObjects } = await serviceClient.storage
      .from('avatars')
      .list(`customers/${customer.id}`);
    for (const obj of oldObjects || []) {
      if (obj.name && `customers/${customer.id}/${obj.name}` !== storagePath) {
        await serviceClient.storage.from('avatars').remove([`customers/${customer.id}/${obj.name}`]);
      }
    }

    const { error: updateError } = await serviceClient
      .from('customers')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', customer.id);

    if (updateError) {
      console.error('[profile-avatar] Update failed:', updateError.message);
      return NextResponse.json({ error: 'Could not update your profile.' }, { status: 500 });
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error('[profile-avatar] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again or contact support.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/profile/avatar', RATE_LIMITS.AUTH);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    const { data: customer } = await serviceClient
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Clear DB reference and delete stored objects
    await serviceClient
      .from('customers')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', customer.id);

    const { data: oldObjects } = await serviceClient.storage
      .from('avatars')
      .list(`customers/${customer.id}`);
    const names = (oldObjects || []).map((o) => o.name).filter(Boolean);
    if (names.length > 0) {
      await serviceClient.storage.from('avatars').remove(names.map((n) => `customers/${customer.id}/${n}`));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[profile-avatar-delete] Error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
