import { NextRequest, NextResponse } from 'next/server';
import { sendLoginNotification, LoginAlertInput } from '@/lib/telegram-notifier';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 });
    }

    let fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    let role = typeof body.role === 'string' ? body.role.trim() : '';

    // If fullName or role is missing, fetch from profiles table
    if (body.userId && (!fullName || !role)) {
      try {
        const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (sbUrl && sbKey) {
          const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, role, is_admin')
            .eq('id', body.userId)
            .maybeSingle();

          if (prof) {
            if (!fullName && prof.full_name) fullName = prof.full_name;
            if (!role) role = prof.is_admin ? 'admin' : (prof.role || 'client');
          }
        }
      } catch (sbErr) {
        console.warn('[NotifyLoginRoute] Profile lookup warning:', sbErr);
      }
    }

    const ip = extractClientIp(req);
    const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || undefined;
    const city = req.headers.get('x-vercel-ip-city') || undefined;
    const userAgent = req.headers.get('user-agent') || body.userAgent || '';

    const payload: LoginAlertInput = {
      type: body.type === 'signup' ? 'signup' : 'login',
      userId: body.userId,
      email,
      fullName: fullName || email.split('@')[0],
      role: role || 'client',
      destination: body.destination,
      status: body.status,
      ip,
      country,
      city,
      userAgent,
    };

    // Dispatch Telegram alert
    const ok = await sendLoginNotification(payload);
    return NextResponse.json({ ok });
  } catch (err: any) {
    console.error('[NotifyLoginRoute] Error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
