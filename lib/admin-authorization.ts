import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminAccess = { client: SupabaseClient; error: null } | { client: null; error: NextResponse };

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
