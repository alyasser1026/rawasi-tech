import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { authorizeAdminRequest } from '@/lib/admin-authorization';

export const runtime = 'nodejs';

const getSupabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'placeholder',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function POST(req: Request) {
  try {
    const access = await authorizeAdminRequest(req, getSupabaseAdmin);
    if (access.error) return access.error;

    revalidatePath('/', 'layout');
    revalidatePath('/');
    revalidatePath('/store');
    revalidatePath('/real-estate');
    revalidatePath('/website');
    return NextResponse.json({ ok: true, revalidatedAt: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Revalidation failed' },
      { status: 500 }
    );
  }
}
