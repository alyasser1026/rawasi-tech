import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminAccess = { client: SupabaseClient; error: null } | { client: null; error: NextResponse };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolves an optional verified user UUID from a Bearer token (safe null fallback for anonymous visitors). */
export async function resolveOptionalRequestUserId(
  client: { auth?: { getUser?: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } } | null,
  request: Request,
  fallbackUserId?: unknown
): Promise<string | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (token && client?.auth?.getUser) {
    try {
      const { data } = await client.auth.getUser(token);
      if (data?.user?.id && UUID_REGEX.test(data.user.id)) {
        return data.user.id;
      }
    } catch {
      // Allow anonymous fallback on expired or absent session token
    }
  }
  const raw = typeof fallbackUserId === 'string' ? fallbackUserId.trim() : '';
  return UUID_REGEX.test(raw) ? raw : null;
}

export async function authorizeAdminRequest(request: Request, getClient: () => SupabaseClient): Promise<AdminAccess> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { client: null, error: NextResponse.json({ error: 'يلزم تسجيل الدخول.' }, { status: 401 }) };
  const client = getClient();
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return { client: null, error: NextResponse.json({ error: 'جلسة الدخول غير صالحة.' }, { status: 401 }) };
  const { data: profile, error } = await client.from('profiles').select('role,is_admin,is_active').eq('id', user.id).single();
  if (error || !profile || profile.is_active === false || !(profile.is_admin || ['admin', 'super_admin'].includes(profile.role))) {
    return { client: null, error: NextResponse.json({ error: 'هذه العملية متاحة لمدير نشط فقط.' }, { status: 403 }) };
  }
  return { client, error: null };
}
