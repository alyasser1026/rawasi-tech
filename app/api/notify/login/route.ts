import { NextRequest, NextResponse } from 'next/server';
import {
  extractClientIp,
  sendLoginNotification,
  LoginAlertInput,
} from '@/lib/telegram-notifier';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    let fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    let role = typeof body.role === 'string' ? body.role.trim() : '';
    let phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const isSignUp = body.type === 'signup';

    try {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const sbKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (sbUrl && sbKey) {
        const supabase = createClient(sbUrl, sbKey, {
          auth: { persistSession: false },
        });

        // 1. Lookup profile by userId or email
        let profQuery = supabase
          .from('profiles')
          .select('id, full_name, role, is_admin, phone_number, linked_partner_id')
          .limit(1);

        profQuery = userId ? profQuery.eq('id', userId) : profQuery.ilike('email', email);
        const { data: prof } = await profQuery.maybeSingle();

        // Sync phone_number on signup if provided
        if (isSignUp && phone && userId && serviceKey) {
          await supabase
            .from('profiles')
            .update({ phone_number: phone })
            .eq('id', userId);
        }

        if (prof) {
          if (!fullName && prof.full_name) fullName = prof.full_name;
          if (!role) role = prof.is_admin ? 'admin' : prof.role || 'client';
          if (!phone && prof.phone_number) phone = prof.phone_number;

          // Fallback to linked partner phone
          if (!phone && prof.linked_partner_id) {
            const { data: partnerRow } = await supabase
              .from('partners')
              .select('phone')
              .eq('id', prof.linked_partner_id)
              .maybeSingle();
            if (partnerRow?.phone) phone = partnerRow.phone;
          }
        }

        // 2. Fallback to auth user metadata if still missing phone/fullName
        if (!phone && userId && serviceKey) {
          const { data: authData } = await supabase.auth.admin.getUserById(userId);
          const authUser = authData?.user;
          if (authUser) {
            const meta = (authUser.user_metadata || {}) as Record<string, any>;
            phone =
              authUser.phone ||
              (typeof meta.phone === 'string' ? meta.phone : '') ||
              (typeof meta.phone_number === 'string' ? meta.phone_number : '');
            if (!fullName && typeof meta.full_name === 'string') {
              fullName = meta.full_name;
            }
          }
        }
      }
    } catch (sbErr) {
      console.warn('[NotifyLoginRoute] Profile/phone lookup warning:', sbErr);
    }

    const ip = extractClientIp(req);
    const country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      undefined;
    const city = req.headers.get('x-vercel-ip-city') || undefined;
    const userAgent = req.headers.get('user-agent') || body.userAgent || '';

    const payload: LoginAlertInput = {
      type: isSignUp ? 'signup' : 'login',
      userId: userId || undefined,
      email,
      fullName: fullName || email.split('@')[0],
      phone: phone || undefined,
      role: role || 'client',
      destination: body.destination,
      status: body.status,
      ip,
      country,
      city,
      userAgent,
      deviceDetails:
        body.deviceDetails && typeof body.deviceDetails === 'object'
          ? body.deviceDetails
          : undefined,
    };

    const ok = await sendLoginNotification(payload);
    return NextResponse.json({ ok });
  } catch (err: any) {
    console.error('[NotifyLoginRoute] Error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
